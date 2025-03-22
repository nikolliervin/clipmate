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
                timestamp: item.timestamp || Date.now()
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