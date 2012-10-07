require 'singleton'

module Condo
	
	class Configuration
		include Singleton
		
		@@callbacks = {
			#:resident_id		# Must be defined by the including class
			:bucket_name => proc {"#{Rails.application.class.parent_name}#{instance_eval @@callbacks[:resident_id]}"},
			:object_key => proc {params[:file_name]},
			:object_options => proc {{:permissions => :private}},
			:pre_validation => proc {true},	# To respond with errors use: lambda {return false, {:errors => {:param_name => 'wtf are you doing?'}}}
			:sanitize_filename => proc {
				params[:file_name].tap do |filename|
					filename.gsub!(/^.*(\\|\/)/, '')	# get only the filename (just in case)
					filename.gsub!(/[^\w\.\-]/,'_')		# replace all non alphanumeric or periods with underscore
				end
			}
			#:upload_complete	# Must be defined by the including class
			#:destroy_upload	# the actual delete should be done by the application
			#:dynamic_residence	# If the data stores are dynamically stored by the application
		}
		
		@@dynamics = {}
		
		def self.callbacks
			@@callbacks
		end
		
		def self.set_callback(name, callback = nil, &block)
			if callback.is_a?(Proc)
				@@callbacks[name.to_sym] = callback
			elsif block.present?
				@@callbacks[name.to_sym] = block
			else
				raise ArgumentError, 'Condo callbacks must be defined with a Proc or Proc (lamba) object present'
			end
		end
		
		
		def self.set_dynamic_provider(namespace, callback = nil, &block)
			if callback.is_a?(Proc)
				@@dynamics[namespace.to_sym] = callback
			elsif block.present?
				@@dynamics[namespace.to_sym] = block
			else
				raise ArgumentError, 'Condo callbacks must be defined with a Proc or Proc (lamba) object present'
			end
		end
		
		def dynamic_provider_present?(namespace)
			return false if @@dynamics.nil?
			return false if @@dynamics[namespace.to_sym].nil?
			return true
		end
		
		
		def self.add_residence(name, options = {})
			@@residencies ||= []
			@@residencies << ("Condo::Strata::#{name.to_s.camelize}".constantize.new(options)).tap do |res|
				name = name.to_sym
				namespace = (options[:namespace] || :global).to_sym
				
				@@locations ||= {}
				@@locations[namespace] ||= {}
				@@locations[namespace][name] ||= {}
				
				if options[:location].present?
					@@locations[namespace][name][options[:location].to_sym] = res
				else
					@@locations[namespace][name][:default] = res
					@@locations[namespace][name][res.location] = res
				end
			end
		end
		
		
		def residencies
			@@residencies
		end
		
		
		def set_residence(name, options)
			if options[:namespace].present? && dynamic_provider_present?(options[:namespace])
				if options[:upload].present?
					upload = options[:upload]
					params = {
						:user_id => upload.user_id,
						:file_name => upload.file_name,
						:file_size => upload.file_size,
						:custom_params => upload.custom_params,
						:provider_name => upload.provider_name,
						:provider_location => upload.provider_location,
						:provider_namespace => upload.provider_namespace
					}
					return instance_exec params, &@@dynamics[upload.provider_namespace]
				else
					params = {
						:user_id => options[:resident],
						:file_name => options[:params][:file_name],
						:file_size => options[:params][:file_size],
						:custom_params => options[:params][:custom_params],
						:provider_namespace => options[:namespace]
					}
					return instance_exec params, &@@dynamics[options[:namespace]]
				end
			else
				if !!options[:dynamic]
					return "Condo::Strata::#{name.to_s.camelize}".constantize.new(options)
				else
					return options[:location].present? ? @@locations[options[:namespace]][name.to_sym][options[:location].to_sym] : @@locations[options[:namespace]][name.to_sym][:default]
				end
			end
		end
		
	end
	
end