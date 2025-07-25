function extract_service(tag, timestamp, record)
    local path = record["file_path"]
    if path then
        local filename = string.match(path, "([^/]+)$")
        if filename then
            local pod_name = string.match(filename, "^[^_]+_([^%.]+)%.log")
            if pod_name then
                local service = string.match(pod_name, "(.+)%-.+%-.+$")
                if service then
                    record["service"] = service
                else
                    record["service"] = pod_name
                end
                record["ddtags"] = "pod_name:" .. pod_name .. ",service:" .. record["service"]
            end
        end
    end
    return 1, timestamp, record
end