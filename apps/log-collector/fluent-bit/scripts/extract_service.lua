function extract_service(tag, timestamp, record)
    local path = record["file_path"]
    if path and type(path) == "string" then
        local filename = string.match(path, "([^/]+)$")
        if filename then
            local pod_name = string.match(filename, "^[^_]+_([^%.]+)%.log$")
            if pod_name then
                local service = string.match(pod_name, "^(.+)%-[^%-]+-[^%-]+$")
                if service then
                    record["service"] = service
                else
                    service = string.match(pod_name, "^(.+)%-[^%-]+$")
                    if service then
                        record["service"] = service
                    else
                        record["service"] = pod_name
                    end
                end
                record["ddtags"] = "pod_name:" .. pod_name .. ",service:" .. record["service"]
            else
                record["parse_error"] = "failed_to_extract_pod_name"
            end
        else
            record["parse_error"] = "failed_to_extract_filename"
        end
    else
        record["parse_error"] = "missing_or_invalid_file_path"
    end
    return 1, timestamp, record
end