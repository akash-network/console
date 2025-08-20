--[[
 * Extracts metadata from Kubernetes pod log filenames for Datadog integration
 *
 * This function processes log file paths to extract:
 * 1. Pod name from the filename (namespace_podname.log format)
 * 2. Service name by parsing the pod name pattern
 * 3. Datadog tags for proper log categorization and filtering
 *
 * Supported filename formats:
 * - Current logs: namespace_podname.log
 * - Rotated logs: namespace_podname.log.1, namespace_podname.log.2, etc.
 *
 * Pod naming patterns supported:
 * - StatefulSet: "service-0" → service = "service"
 * - Deployment: "service-hash-random" → service = "service"
 * - Fallback: uses entire pod name as service
 *
 * @param tag - Fluent Bit tag (unused but required by interface)
 * @param timestamp - Log timestamp (unused but required by interface)
 * @param record - Log record containing file_path and other fields
 * @return 1, timestamp, record - Modified record with extracted metadata
--]]

function extract_metadata(tag, timestamp, record)
    -- Extract file path from the log record
    local path = record["file_path"]
    if not path then
        return 1, timestamp, record
    end

    -- Extract filename (last component of the path)
    -- Example: "/app/log/namespace_podname.log" → "namespace_podname.log"
    local filename = string.match(path, "([^/]+)$")
    if not filename then
        return 1, timestamp, record
    end

    -- Extract pod name from filename using namespace_podname.log pattern
    -- Supports both current (.log) and rotated (.log.N) files
    local pod_name = string.match(filename, "^[^_]+_([^%.]+)%.log")            -- .log
    if not pod_name then
        pod_name = string.match(filename, "^[^_]+_([^%.]+)%.log%.%d+$")        -- .log.N
    end
    if not pod_name then
        return 1, timestamp, record
    end

    -- Extract service name from pod name using Kubernetes naming patterns
    -- Pattern 1: StatefulSet format "service-0" → service = "service"
    local service = string.match(pod_name, "^(.-)%-%d+$")
    if not service then
        -- Pattern 2: Deployment format "service-hash-random" → service = "service"
        service = string.match(pod_name, "^(.-)%-.+%-.+$")
    end
    if not service then
        -- Pattern 3: Fallback - use entire pod name as service
        service = pod_name
    end

    -- Set extracted metadata in the record for Datadog integration
    record["service"] = service
    record["ddtags"]  = "pod_name:" .. pod_name .. ",service:" .. service

    return 1, timestamp, record
end