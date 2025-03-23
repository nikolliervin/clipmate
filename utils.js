const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const REGISTRY_DIR = GLib.get_user_cache_dir() + '/clipmate@clipmate.github.io';
const REGISTRY_FILE = 'clipboard_history.json';
const REGISTRY_PATH = REGISTRY_DIR + '/' + REGISTRY_FILE;

function debug(message) {
    try {
        let extension = imports.misc.extensionUtils.getCurrentExtension();
        if (extension && extension.metadata && extension.metadata.debug) {
            log('ClipMate [DEBUG]: ' + message);
        }
    } catch (e) {
        log('ClipMate [DEBUG]: ' + message);
    }
}

function prettyPrint(name, obj, recurse, _indent) {
    let prefix = '';
    let indent = typeof _indent === 'number' ? _indent : 0;
    for (let i = 0; i < indent; i++) {
        prefix += '    ';
    }

    recurse = typeof recurse === 'boolean' ? recurse : true;
    if (typeof name !== 'string') {
        obj = arguments[0];
        recurse = arguments[1];
        _indent = arguments[2];
        name = obj.toString();
    }

    log(prefix + '--------------');
    log(prefix + name);
    log(prefix + '--------------');
    for (let k in obj) {
        if (typeof obj[k] === 'object' && recurse) {
            prettyPrint(name + '::' + k, obj[k], true, indent + 1);
        }
        else {
            log(prefix + k, typeof obj[k] === 'function' ? '[Func]' : obj[k]);
        }
    }
}

function prepareRegistryForSaving(registry) {
    try {
        if (!registry || !Array.isArray(registry)) {
            log('ClipMate: Invalid registry provided');
            return [];
        }
        
        let processedRegistry = [];
        
        for (let i = 0; i < registry.length; i++) {
            let item = registry[i];
            
            if (!item || typeof item.type === 'undefined') {
                log(`ClipMate: Invalid item at index ${i}, skipping`);
                continue;
            }
            
            let processedItem = {
                type: item.type,
                timestamp: item.timestamp || Date.now(),
                favorite: !!item.favorite
            };
            
            if (item.type === 0) { // TEXT
                if (item.content) {
                    processedItem.content = item.content;
                } else {
                    log(`ClipMate: Text item without content at index ${i}, skipping`);
                    continue;
                }
            } else if (item.type === 1) { // IMAGE
                processedItem.mimeType = item.mimeType || 'image/png';
                processedItem.content = null;
            } else {
                log(`ClipMate: Unknown item type ${item.type} at index ${i}, skipping`);
                continue;
            }
            
            processedRegistry.push(processedItem);
        }
        
        return processedRegistry;
    } catch (e) {
        log(`ClipMate: Error preparing registry for saving: ${e}`);
        return [];
    }
}

function writeRegistry(registry) {
    if (!registry) {
        log('ClipMate: No registry provided, nothing to save');
        return false;
    }
    
    try {
        let dirFile = Gio.File.new_for_path(REGISTRY_DIR);
        if (!dirFile.query_exists(null)) {
            try {
                dirFile.make_directory_with_parents(null);
                log(`ClipMate: Created directory ${REGISTRY_DIR}`);
            } catch (dirError) {
                log(`ClipMate: Failed to create directory: ${dirError.message}`);
                return false;
            }
        }
        
        let processedRegistry = prepareRegistryForSaving(registry);
        let jsonData = JSON.stringify(processedRegistry, null, 2);
        let file = Gio.File.new_for_path(REGISTRY_PATH);
        let bytes = new GLib.Bytes(jsonData);
        
        try {
            let [success, etag] = file.replace_contents(
                bytes.toArray(),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            
            if (success) {
                log(`ClipMate: Successfully saved ${processedRegistry.length} items to ${REGISTRY_PATH}`);
                return true;
            } else {
                log(`ClipMate: Failed to save history file, no error reported`);
                return false;
            }
        } catch (writeError) {
            log(`ClipMate: Error writing registry file: ${writeError.message}`);
            return false;
        }
    } catch (e) {
        log(`ClipMate: Error in writeRegistry: ${e.message}`);
        return false;
    }
}

function readRegistry(callback) {
    if (typeof callback !== 'function') {
        log('ClipMate: Invalid callback for readRegistry');
        return;
    }
    
    try {
        let file = Gio.File.new_for_path(REGISTRY_PATH);
        
        if (!file.query_exists(null)) {
            log('ClipMate: Registry file does not exist yet, starting with empty history');
            callback([]);
            return;
        }
        
        try {
            let [success, contents, etag] = file.load_contents(null);
            
            if (success) {
                try {
                    let contentsStr;
                    if (contents instanceof Uint8Array) {
                        contentsStr = new TextDecoder().decode(contents);
                    } else {
                        contentsStr = contents.toString();
                    }
                    
                    let registry = JSON.parse(contentsStr);
                    
                    if (!Array.isArray(registry)) {
                        log('ClipMate: Registry file contains invalid data (not an array)');
                        callback([]);
                        return;
                    }
                    
                    let validRegistry = registry.filter(item => 
                        item && 
                        (item.type === 0 || item.type === 1) && 
                        (item.type !== 0 || item.content)
                    );
                    
                    if (validRegistry.length !== registry.length) {
                        log(`ClipMate: Filtered ${registry.length - validRegistry.length} invalid items from registry`);
                    }
                    
                    log(`ClipMate: Successfully loaded ${validRegistry.length} items from history file`);
                    callback(validRegistry);
                } catch (parseError) {
                    log(`ClipMate: Error parsing registry file: ${parseError.message}`);
                    callback([]);
                }
            } else {
                log('ClipMate: Failed to read registry file');
                callback([]);
            }
        } catch (readError) {
            log(`ClipMate: Error reading registry file: ${readError.message}`);
            callback([]);
        }
    } catch (e) {
        log(`ClipMate: Error in readRegistry: ${e.message}`);
        callback([]);
    }
}

// Export clipboard history to a user-selected file
function exportClipboardHistory(callback) {
    try {
        // First check if we have any history to export
        let historyFile = Gio.File.new_for_path(REGISTRY_PATH);
        
        if (!historyFile.query_exists(null)) {
            log('ClipMate: No clipboard history to export');
            if (typeof callback === 'function') {
                callback(false, 'No clipboard history to export');
            }
            return;
        }
        
        // Create the default filename with timestamp
        let now = new Date();
        let timestamp = now.getFullYear() + '-' + 
                      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(now.getDate()).padStart(2, '0') + '_' + 
                      String(now.getHours()).padStart(2, '0') + '-' + 
                      String(now.getMinutes()).padStart(2, '0');
        
        let defaultFileName = 'clipmate_backup_' + timestamp + '.json';
        let defaultPath = GLib.get_home_dir() + '/' + defaultFileName;
        
        // Read the current clipboard history
        let [success, contents, etag] = historyFile.load_contents(null);
        if (!success) {
            log('ClipMate: Failed to read clipboard history for export');
            if (typeof callback === 'function') {
                callback(false, 'Failed to read clipboard history');
            }
            return;
        }
        
        // Create the export file
        let exportFile = Gio.File.new_for_path(defaultPath);
        
        try {
            let [exportSuccess, exportEtag] = exportFile.replace_contents(
                contents,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            
            if (exportSuccess) {
                log(`ClipMate: Successfully exported clipboard history to ${defaultPath}`);
                if (typeof callback === 'function') {
                    callback(true, defaultPath);
                }
            } else {
                log('ClipMate: Failed to export clipboard history');
                if (typeof callback === 'function') {
                    callback(false, 'Export operation failed');
                }
            }
        } catch (writeError) {
            log(`ClipMate: Error writing export file: ${writeError.message}`);
            if (typeof callback === 'function') {
                callback(false, writeError.message);
            }
        }
    } catch (e) {
        log(`ClipMate: Error in exportClipboardHistory: ${e.message}`);
        if (typeof callback === 'function') {
            callback(false, e.message);
        }
    }
}

// Import clipboard history from a user-selected file
function importClipboardHistory(filePath, callback) {
    try {
        if (!filePath) {
            log('ClipMate: No file specified for import');
            if (typeof callback === 'function') {
                callback(false, 'No file specified');
            }
            return;
        }
        
        let importFile = Gio.File.new_for_path(filePath);
        
        if (!importFile.query_exists(null)) {
            log(`ClipMate: Import file ${filePath} does not exist`);
            if (typeof callback === 'function') {
                callback(false, 'File does not exist');
            }
            return;
        }
        
        // Try to read the import file
        try {
            let [success, contents, etag] = importFile.load_contents(null);
            
            if (!success) {
                log('ClipMate: Failed to read import file');
                if (typeof callback === 'function') {
                    callback(false, 'Failed to read import file');
                }
                return;
            }
            
            // Validate the content as JSON
            let contentsStr;
            if (contents instanceof Uint8Array) {
                contentsStr = new TextDecoder().decode(contents);
            } else {
                contentsStr = contents.toString();
            }
            
            try {
                let importedData = JSON.parse(contentsStr);
                
                if (!Array.isArray(importedData)) {
                    log('ClipMate: Import file contains invalid data (not an array)');
                    if (typeof callback === 'function') {
                        callback(false, 'Invalid data format (not an array)');
                    }
                    return;
                }
                
                // Validate items in the array
                let validItems = importedData.filter(item => 
                    item && 
                    (item.type === 0 || item.type === 1) && 
                    (item.type !== 0 || item.content)
                );
                
                if (validItems.length === 0) {
                    log('ClipMate: No valid clipboard items found in import file');
                    if (typeof callback === 'function') {
                        callback(false, 'No valid clipboard items found');
                    }
                    return;
                }
                
                // Create directory if it doesn't exist
                let dirFile = Gio.File.new_for_path(REGISTRY_DIR);
                if (!dirFile.query_exists(null)) {
                    try {
                        dirFile.make_directory_with_parents(null);
                    } catch (dirError) {
                        log(`ClipMate: Failed to create directory: ${dirError.message}`);
                        if (typeof callback === 'function') {
                            callback(false, 'Failed to create storage directory');
                        }
                        return;
                    }
                }
                
                // Write the validated data to the registry file
                let historyFile = Gio.File.new_for_path(REGISTRY_PATH);
                let bytes = new GLib.Bytes(contentsStr);
                
                try {
                    let [writeSuccess, writeEtag] = historyFile.replace_contents(
                        bytes.toArray(),
                        null,
                        false,
                        Gio.FileCreateFlags.REPLACE_DESTINATION,
                        null
                    );
                    
                    if (writeSuccess) {
                        log(`ClipMate: Successfully imported ${validItems.length} clipboard items`);
                        if (typeof callback === 'function') {
                            callback(true, validItems.length);
                        }
                    } else {
                        log('ClipMate: Failed to save imported history file');
                        if (typeof callback === 'function') {
                            callback(false, 'Failed to save imported data');
                        }
                    }
                } catch (writeError) {
                    log(`ClipMate: Error writing imported data: ${writeError.message}`);
                    if (typeof callback === 'function') {
                        callback(false, writeError.message);
                    }
                }
                
            } catch (parseError) {
                log(`ClipMate: Error parsing import file: ${parseError.message}`);
                if (typeof callback === 'function') {
                    callback(false, 'Invalid JSON format');
                }
            }
            
        } catch (readError) {
            log(`ClipMate: Error reading import file: ${readError.message}`);
            if (typeof callback === 'function') {
                callback(false, readError.message);
            }
        }
    } catch (e) {
        log(`ClipMate: Error in importClipboardHistory: ${e.message}`);
        if (typeof callback === 'function') {
            callback(false, e.message);
        }
    }
} 