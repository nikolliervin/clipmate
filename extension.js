'use strict';

const { St, Clutter, GObject, GLib, Shell, Meta, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Modal = Me.imports.modal;

const SETTING_TOGGLE_MENU = 'toggle-clipboard-menu';
const SCHEMA_NAME = 'org.gnome.shell.extensions.clipmate';

let MAX_HISTORY = 20;
let MAX_TOPBAR_LENGTH = 15;
let NOTIFY_ON_COPY = false;
let CONFIRM_ON_CLEAR = true;
let ENABLE_KEYBINDING = true;
let DEBUG_MODE = false;

const ClipItemType = {
    TEXT: 0,
    IMAGE: 1
};

let clipHistory = [];
let keyPressEventId = null;
let settings = null;
let searchEntryTimeout = null;
let lastClipboardText = '';
let clipboardTimeoutId = 0;

function debug(message) {
    if (DEBUG_MODE) {
        log('ClipMate [DEBUG]: ' + message);
    }
}

class ClipPopupMenu {
    constructor() {
        // Create the popup menu
        this._menu = new PopupMenu.PopupMenu(Main.layoutManager.dummyCursor, 0.0, St.Side.TOP);
        this._menu.actor.add_style_class_name('popup-menu-boxpointer');
        this._menu.actor.add_style_class_name('popup-menu');
        
        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();
        
        // Create search entry
        this._createSearchEntry();
        
        this._buildMenu();
    }

    _createSearchEntry() {
        this._searchEntry = new St.Entry({
            name: 'searchEntry',
            style_class: 'search-entry',
            can_focus: true,
            hint_text: 'Type to search...',
            track_hover: true,
            x_expand: true
        });

        this._searchEntry.clutter_text.connect('text-changed', () => {
            if (searchEntryTimeout) {
                GLib.source_remove(searchEntryTimeout);
                searchEntryTimeout = null;
            }
            
            searchEntryTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                this._filterItems(this._searchEntry.get_text());
                searchEntryTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        });
        
        // Add search entry to menu
        let searchMenuItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });
        searchMenuItem.add(this._searchEntry);
        this._menu.addMenuItem(searchMenuItem);
        
        // Add separator after search
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _filterItems(searchText) {
        // Remove all items except search and separator
        let items = this._menu._getMenuItems();
        for (let i = items.length - 1; i >= 2; i--) {
            items[i].destroy();
        }
        
        let searchLower = searchText.toLowerCase();
        let hasItems = false;
        
        // Add filtered items
        for (let i = 0; i < clipHistory.length; i++) {
            let item = clipHistory[i];
            
            // Only filter text items with content
            if (item.type === ClipItemType.TEXT && 
                item.content && 
                (!searchLower || item.content.toLowerCase().indexOf(searchLower) !== -1)) {
                let menuItem = this._createMenuItem(item);
                this._menu.addMenuItem(menuItem);
                hasItems = true;
            } else if (item.type === ClipItemType.IMAGE && !searchLower) {
                // Image items are shown only when no search text
                let menuItem = this._createMenuItem(item);
                this._menu.addMenuItem(menuItem);
                hasItems = true;
            }
        }
        
        // Add clear history option if we have items
        if (hasItems) {
            this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let clearItem = new PopupMenu.PopupMenuItem("Clear History");
            clearItem.connect('activate', () => {
                this._clearHistory();
            });
            this._menu.addMenuItem(clearItem);
        } else if (searchLower) {
            // Show "no results" message
            let noResults = new PopupMenu.PopupMenuItem("No results found");
            noResults.actor.reactive = false;
            this._menu.addMenuItem(noResults);
        }
    }

    _removeItemFromHistory(item) {
        // Find the exact item in history
        let index = -1;
        for (let i = 0; i < clipHistory.length; i++) {
            if (clipHistory[i] === item) {
                index = i;
                break;
            }
        }
        
        // Remove the item at the specified index
        if (index >= 0) {
            log(`ClipMate: Removing item at index ${index}`);
            
            clipHistory.splice(index, 1);
            
            // Update storage
            Utils.writeRegistry(clipHistory);
            
            // Rebuild menu
            this._filterItems(this._searchEntry.get_text());
            
            // Also update panel menu if it exists
            if (this._panelMenu) {
                this._panelMenu._buildMenu();
            }
        }
    }

    _clearHistory() {
        if (CONFIRM_ON_CLEAR) {
            Modal.openModal(
                "Clear History",
                "Are you sure you want to clear clipboard history?",
                "Clear",
                "Cancel",
                () => {
                    this._doClearHistory();
                }
            );
        } else {
            this._doClearHistory();
        }
    }
    
    _doClearHistory() {
        // Clear the global clipboard history array
        clipHistory.splice(0, clipHistory.length);
        
        // Update storage
        Utils.writeRegistry(clipHistory);
                
        // Close the menu since there's nothing to show
        this._menu.close();
        
        // Rebuild menu (it will be empty)
        this._buildMenu();
                
        // Update panel menu if it exists
        if (this._panelMenu) {
            this._panelMenu._buildMenu();
        }
                
        // Log for debugging
        log('ClipMate: History cleared from popup menu');
    }

    _createMenuItem(item) {
        // Create a box layout to hold both content and trash icon
        let menuItemBox = new St.BoxLayout({
            style_class: 'clipboard-item-box',
            x_expand: true,
            y_expand: true
        });
        
        // Handle different types of clipboard content
        if (item.type === ClipItemType.TEXT) {
            let displayText = item.content.length > MAX_TOPBAR_LENGTH ? 
                item.content.substring(0, MAX_TOPBAR_LENGTH - 3) + "..." : item.content;
            
            // Create the label for the clipboard text
            let label = new St.Label({
                text: displayText,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true
            });
            menuItemBox.add_child(label);
        } 
        else if (item.type === ClipItemType.IMAGE) {
            // Create an icon or thumbnail for the image
            let imageIcon = new St.Icon({
                icon_name: 'image-x-generic-symbolic',
                style_class: 'clipboard-image-icon',
                icon_size: 16
            });
            
            let imageLabel = new St.Label({
                text: " [Image]",
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true
            });
            
            menuItemBox.add_child(imageIcon);
            menuItemBox.add_child(imageLabel);
        }
        
        // Create the trash icon button
        let trashIcon = new St.Icon({
            icon_name: 'user-trash-symbolic',
            style_class: 'clipboard-trash-icon',
            icon_size: 16
        });
        
        let trashButton = new St.Button({
            style_class: 'clipboard-trash-button',
            child: trashIcon,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
            can_focus: true,
            track_hover: true
        });
        
        // Connect the trash button click event
        trashButton.connect('button-press-event', () => {
            this._removeItemFromHistory(item);
            return Clutter.EVENT_STOP;
        });
        
        menuItemBox.add_child(trashButton);
        
        // Create a custom menu item
        let menuItem = new PopupMenu.PopupBaseMenuItem({
            style_class: 'clipboard-menu-item',
            can_focus: true
        });
        menuItem.add_child(menuItemBox);
        
        // Connect the click event for copying (simplified approach)
        menuItem.connect('activate', () => {
            if (item.type === ClipItemType.TEXT) {
                // Just copy to clipboard without trying to paste
                Clipboard.set_text(CLIPBOARD_TYPE, item.content);
                
                // Close the menu
                this._menu.close();
                
                // Show a notification that user should paste manually
                this._showNotification("Copied to clipboard", "Press Ctrl+V to paste");
            }
            else if (item.type === ClipItemType.IMAGE) {
                Clipboard.set_content(CLIPBOARD_TYPE, item.mimeType, item.content);
                this._menu.close();
                this._showNotification("Image copied", "Press Ctrl+V to paste");
            }
        });
        
        return menuItem;
    }

    _showNotification(title, message) {
        let source = new MessageTray.Source('ClipMate', 'edit-paste-symbolic');
        Main.messageTray.add(source);
        
        let notification = new MessageTray.Notification(source, title, message);
        notification.setTransient(true);
        source.showNotification(notification);
    }

    _buildMenu() {
        // Reset search
        if (this._searchEntry) {
            this._searchEntry.set_text('');
        }
        
        // Build menu with all items (no filter)
        this._filterItems('');
    }

    showAtPointer() {
        let [x, y] = global.get_pointer();
        this._menu.actor.set_position(x, y);
        this._buildMenu();
        this._menu.open();
        
        // Focus search entry
        global.stage.set_key_focus(this._searchEntry);
    }

    showNearFocus(focusedElement) {
        // Store the focused element for later use
        this._lastFocusedElement = focusedElement;
        
        // Position near focused element if possible
        if (focusedElement && focusedElement.get_position) {
            try {
                let [x, y] = focusedElement.get_transformed_position();
                let rect = focusedElement.get_allocation_box();
                
                // Place menu below the text field
                this._menu.actor.set_position(x, y + rect.y2 - rect.y1);
            } catch (e) {
                // Fallback to pointer position if we can't get element position
                let [x, y] = global.get_pointer();
                this._menu.actor.set_position(x, y);
            }
        } else {
            // Fallback to pointer position
            let [x, y] = global.get_pointer();
            this._menu.actor.set_position(x, y);
        }
        
        this._buildMenu();
        this._menu.open();
        
        // Focus search entry
        global.stage.set_key_focus(this._searchEntry);
    }

    isOpen() {
        return this._menu.isOpen;
    }

    close() {
        this._menu.close();
    }

    destroy() {
        if (searchEntryTimeout) {
            GLib.source_remove(searchEntryTimeout);
            searchEntryTimeout = null;
        }
        this._menu.destroy();
    }
}

// Panel button with clipboard history
const ClipMateIndicator = GObject.registerClass(
    class ClipMateIndicator extends PanelMenu.Button {
        _init() {
            super._init(0, 'ClipMate');

            // Add icon to the panel
            let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
            
            this.icon = new St.Icon({
                icon_name: 'edit-paste-symbolic',
                style_class: 'system-status-icon'
            });
            hbox.add_child(this.icon);
            
            this._topbarLabel = new St.Label({
                text: '',
                y_align: Clutter.ActorAlign.CENTER
            });
            hbox.add_child(this._topbarLabel);
            
            this.add_child(hbox);
            
            // Build the menu first
            this._buildMenu();
            
            // Then initialize clipboard monitoring
            this._initClipboardMonitoring();
        }
        
        setCurrentClipboardText(text) {
            if (text && text.length > 0) {
                let displayText = text.length > MAX_TOPBAR_LENGTH ? 
                    text.substring(0, MAX_TOPBAR_LENGTH - 3) + "..." : text;
                this._topbarLabel.set_text(displayText);
            } else {
                this._topbarLabel.set_text('');
            }
        }

        _initClipboardMonitoring() {
            log('ClipMate: Initializing clipboard monitoring');
            
            // First get the current clipboard text to initialize our state
            Clipboard.get_text(CLIPBOARD_TYPE, (clipboard, text) => {
                if (text) {
                    lastClipboardText = text;
                    this.setCurrentClipboardText(text);
                    log(`ClipMate: Initial clipboard text: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
                }
            });
            
            // Start the monitoring cycle
            this._startClipboardMonitoring();
        }

        _startClipboardMonitoring() {
            // Clear any existing monitoring
            if (clipboardTimeoutId !== 0) {
                GLib.source_remove(clipboardTimeoutId);
                clipboardTimeoutId = 0;
            }
            
            // Set up monitoring with a short interval
            clipboardTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                this._checkClipboard();
                return GLib.SOURCE_CONTINUE; // Continue the timeout
            });
            
            log('ClipMate: Clipboard monitoring started');
        }

        _checkClipboard() {
            // Check for text content first
                Clipboard.get_text(CLIPBOARD_TYPE, (clipboard, text) => {
                if (text && text !== lastClipboardText) {
                    log(`ClipMate: New clipboard text detected: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
                    lastClipboardText = text;
                    this._handleNewClipboardText(text);
                }
            });
            
            // Also check for image content
            try {
                Clipboard.get_content(CLIPBOARD_TYPE, (clipboard, bytes, mimeType) => {
                    if (bytes && mimeType && mimeType.startsWith('image/')) {
                        log(`ClipMate: Image content detected (${mimeType})`);
                        this._handleNewClipboardImage(bytes, mimeType);
                    }
                });
            } catch (e) {
                // If image checking fails, log but don't interrupt monitoring
                log(`ClipMate: Error checking for image content: ${e}`);
            }
            
                return GLib.SOURCE_CONTINUE;
        }

        _handleNewClipboardText(text) {
            // Skip empty text
            if (!text || text.trim() === '') {
                return;
            }
            
            log(`ClipMate: Processing clipboard text: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
            
            // Check if this text is already in our history
            let existingIndex = -1;
            for (let i = 0; i < clipHistory.length; i++) {
                if (clipHistory[i].type === ClipItemType.TEXT && 
                    clipHistory[i].content === text) {
                    existingIndex = i;
                    break;
                }
            }
            
            // If it exists but is not at the top, move it to the top
            if (existingIndex > 0) {
                log('ClipMate: Text already exists in history, moving to top');
                let item = clipHistory.splice(existingIndex, 1)[0];
                clipHistory.unshift(item);
            } 
            // If it's not in history yet, add it
            else if (existingIndex === -1) {
                log('ClipMate: Adding new text item to history');
                
                // Update display in panel
                this.setCurrentClipboardText(text);
                
                // Show notification if enabled
                if (NOTIFY_ON_COPY) {
                    this._showNotification("Text Copied", text);
                }
                
                // Add to history
                clipHistory.unshift({
                    type: ClipItemType.TEXT,
                    content: text,
                    timestamp: Date.now()
                });
                
                // Trim history if needed
                if (clipHistory.length > MAX_HISTORY) {
                    clipHistory.pop();
                }
            }
            
            // Update UI and storage
            this._buildMenu();
            if (this._popupMenu) {
                this._popupMenu._buildMenu();
            }
            
            // Persist to storage
            Utils.writeRegistry(clipHistory);
            log(`ClipMate: History now contains ${clipHistory.length} items`);
        }

        _handleNewClipboardImage(bytes, mimeType) {
            if (!bytes || !mimeType || !mimeType.startsWith('image/')) {
                return;
            }
            
            log(`ClipMate: Processing clipboard image (${mimeType})`);
            
            // For images, always add as new since comparing image bytes reliably is difficult
            
            // Show notification if enabled
            if (NOTIFY_ON_COPY) {
                this._showNotification("Image Copied", "[Image]");
            }
            
            // Add to history
            clipHistory.unshift({
                type: ClipItemType.IMAGE,
                content: bytes,
                mimeType: mimeType,
                timestamp: Date.now()
            });
            
            // Trim history if needed
            if (clipHistory.length > MAX_HISTORY) {
                clipHistory.pop();
            }
            
            // Update UI
            this._buildMenu();
            if (this._popupMenu) {
                this._popupMenu._buildMenu();
            }
            
            // Update storage
            Utils.writeRegistry(clipHistory);
            log(`ClipMate: History now contains ${clipHistory.length} items (with new image)`);
        }

        _showNotification(title, message) {
            let source = new MessageTray.Source('ClipMate', 'edit-paste-symbolic');
            Main.messageTray.add(source);
            
            let notification = new MessageTray.Notification(source, title, message);
            notification.setTransient(true);
            source.showNotification(notification);
        }

        _removeItemFromHistory(item) {
            // Find the exact item in history
            let index = -1;
            for (let i = 0; i < clipHistory.length; i++) {
                if (clipHistory[i] === item) {
                    index = i;
                    break;
                }
            }
            
            // Remove the item at the specified index
            if (index >= 0) {
                log(`ClipMate: Removing item at index ${index}`);
                
                clipHistory.splice(index, 1);
                
                // Update storage
                Utils.writeRegistry(clipHistory);
                
                this._buildMenu();
                
                // Also update popup menu if it exists
                if (this._popupMenu) {
                    this._popupMenu._buildMenu();
                }
            }
        }

        _clearHistory() {
            if (CONFIRM_ON_CLEAR) {
                Modal.openModal(
                    "Clear History",
                    "Are you sure you want to clear clipboard history?",
                    "Clear",
                    "Cancel",
                    () => {
                        this._doClearHistory();
                    }
                );
            } else {
                this._doClearHistory();
            }
        }
        
        _doClearHistory() {
            // Clear the global clipboard history array
            clipHistory.splice(0, clipHistory.length);
            
            // Update storage
            Utils.writeRegistry(clipHistory);
            
            // Rebuild menu (it will be empty)
            this._buildMenu();
            
            // Also update the popup menu if it exists
            if (this._popupMenu) {
                this._popupMenu._buildMenu();
            }
            
            // Log for debugging
            log('ClipMate: History cleared from panel menu');
        }

        _buildMenu() {
            this.menu.removeAll();

            for (let i = 0; i < clipHistory.length; i++) {
                let item = clipHistory[i];
                let menuItem = this._createMenuItem(item);
                this.menu.addMenuItem(menuItem);
            }

            if (clipHistory.length > 0) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                let clearItem = new PopupMenu.PopupMenuItem("Clear History");
                clearItem.connect('activate', () => {
                    this._clearHistory();
                });
                this.menu.addMenuItem(clearItem);
            }
        }

        _createMenuItem(item) {
            // Create a box layout to hold both content and trash icon
            let menuItemBox = new St.BoxLayout({
                style_class: 'clipboard-item-box',
                x_expand: true
            });
            
            // Handle different types of clipboard content
            if (item.type === ClipItemType.TEXT) {
                let displayText = item.content.length > MAX_TOPBAR_LENGTH ? 
                    item.content.substring(0, MAX_TOPBAR_LENGTH - 3) + "..." : item.content;
                
                // Create the label for the clipboard text
                let label = new St.Label({
                    text: displayText,
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true
                });
                menuItemBox.add_child(label);
            } 
            else if (item.type === ClipItemType.IMAGE) {
                // Create an icon or thumbnail for the image
                let imageIcon = new St.Icon({
                    icon_name: 'image-x-generic-symbolic',
                    style_class: 'clipboard-image-icon',
                    icon_size: 16
                });
                
                let imageLabel = new St.Label({
                    text: " [Image]",
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true
                });
                
                menuItemBox.add_child(imageIcon);
                menuItemBox.add_child(imageLabel);
            }
            
            // Create the trash icon button
            let trashIcon = new St.Icon({
                icon_name: 'user-trash-symbolic',
                style_class: 'clipboard-trash-icon',
                icon_size: 16
            });
            
            let trashButton = new St.Button({
                style_class: 'clipboard-trash-button',
                child: trashIcon,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                can_focus: true,
                track_hover: true
            });
            
            // Connect the trash button click event
            trashButton.connect('button-press-event', () => {
                this._removeItemFromHistory(item);
                return Clutter.EVENT_STOP;
            });
            
            menuItemBox.add_child(trashButton);
            
            // Create a custom menu item
            let menuItem = new PopupMenu.PopupBaseMenuItem({
                style_class: 'clipboard-menu-item'
            });
            menuItem.add_child(menuItemBox);
            
            // Connect the click event for copying (simplified approach)
            menuItem.connect('activate', () => {
                if (item.type === ClipItemType.TEXT) {
                    // Just copy to clipboard without trying to paste
                    Clipboard.set_text(CLIPBOARD_TYPE, item.content);
                    
                    // Close the menu
                    this.menu.close();
                    
                    // Show a notification that user should paste manually
                    this._showNotification("Copied to clipboard", "Press Ctrl+V to paste");
                }
                else if (item.type === ClipItemType.IMAGE) {
                    Clipboard.set_content(CLIPBOARD_TYPE, item.mimeType, item.content);
                    this.menu.close();
                    this._showNotification("Image copied", "Press Ctrl+V to paste");
                }
            });
            
            return menuItem;
        }

        destroy() {
            // Clean up clipboard monitoring
            if (clipboardTimeoutId !== 0) {
                GLib.source_remove(clipboardTimeoutId);
                clipboardTimeoutId = 0;
            }
            
            super.destroy();
        }
    }
);

// Main extension class
class Extension {
    constructor() {
        this._indicator = null;
        this._popupMenu = null;
        this._keyBindingId = null;
        this._lastFocusedElement = null;
    }

    _loadSettings() {
        try {
            // Create gsettings schema
            let schemaDir = Me.dir.get_child('schemas').get_path();
            let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                schemaDir,
                Gio.SettingsSchemaSource.get_default(),
                false
            );
            
            if (!schemaSource) {
                log('ClipMate: Error - could not create schema source');
                return null;
            }
            
            let schema = schemaSource.lookup(SCHEMA_NAME, false);
            
            if (!schema) {
                log('ClipMate: Error - could not find schema ' + SCHEMA_NAME);
                return null;
            }
            
            return new Gio.Settings({ settings_schema: schema });
        } catch (e) {
            log(`ClipMate: Error creating settings: ${e}`);
            return null;
        }
    }

    _toggleMenu() {
        // Store the current focus before opening the menu
        this._lastFocusedElement = global.stage.get_key_focus();
        
        if (this._popupMenu.isOpen()) {
            this._popupMenu.close();
            // Restore focus when closing
            if (this._lastFocusedElement) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    global.stage.set_key_focus(this._lastFocusedElement);
                    return GLib.SOURCE_REMOVE;
                });
            }
        } else {
            // Position the menu closer to where the text cursor might be
            this._popupMenu.showNearFocus(this._lastFocusedElement);
        }
    }
    
    _setupKeybindings(enabled) {
        this._removeKeybindings();
        
        if (enabled) {
            // Add key binding for shortcut
            Main.wm.addKeybinding(
                SETTING_TOGGLE_MENU,
                settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => {
                    this._toggleMenu();
                }
            );
        }
    }
    
    _removeKeybindings() {
        // Remove the keybinding if it exists
        if (Main.wm.removeKeybinding) {
            Main.wm.removeKeybinding(SETTING_TOGGLE_MENU);
        }
    }

    _onKeyPressed(actor, event) {
        // Check for Alt+Space shortcut
        let symbol = event.get_key_symbol();
        let modifiers = event.get_state();
        
        // Store the current focus before handling shortcut
        this._lastFocusedElement = global.stage.get_key_focus();
        
        // Check for Alt+Space (Alt = 8, Space = 65)
        if (symbol === 65 && (modifiers & Clutter.ModifierType.MOD1_MASK)) {
            log('ClipMate: Alt+Space detected!');
            this._toggleMenu();
            return Clutter.EVENT_STOP;
        }
        
        return Clutter.EVENT_PROPAGATE;
    }

    enable() {
        log('ClipMate: Enabling extension');
        
        // Load settings
        settings = this._loadSettings();
        
        if (settings) {
            // Update settings values
            MAX_HISTORY = settings.get_int('history-size');
            MAX_TOPBAR_LENGTH = settings.get_int('topbar-preview-size');
            NOTIFY_ON_COPY = settings.get_boolean('notify-on-copy');
            CONFIRM_ON_CLEAR = settings.get_boolean('confirm-clear');
            ENABLE_KEYBINDING = settings.get_boolean('enable-keybindings');
            DEBUG_MODE = settings.get_boolean('debug-mode');
            
            // Connect to settings changes
            this._settingsChangedId = settings.connect('changed', (settings, key) => {
                if (key === 'history-size') {
                    MAX_HISTORY = settings.get_int(key);
                } else if (key === 'topbar-preview-size') {
                    MAX_TOPBAR_LENGTH = settings.get_int(key);
                } else if (key === 'notify-on-copy') {
                    NOTIFY_ON_COPY = settings.get_boolean(key);
                } else if (key === 'confirm-clear') {
                    CONFIRM_ON_CLEAR = settings.get_boolean(key);
                } else if (key === 'enable-keybindings') {
                    ENABLE_KEYBINDING = settings.get_boolean(key);
                    this._setupKeybindings(ENABLE_KEYBINDING);
                } else if (key === 'debug-mode') {
                    DEBUG_MODE = settings.get_boolean(key);
                    log('ClipMate: Debug mode ' + (DEBUG_MODE ? 'enabled' : 'disabled'));
                }
            });
        }
        
        // Load clipboard history from storage
        Utils.readRegistry((history) => {
            try {
                if (Array.isArray(history)) {
                    clipHistory = history;
                    log(`ClipMate: Loaded ${history.length} items from storage`);
                }
                
                // Create UI after loading history
        this._indicator = new ClipMateIndicator();
        Main.panel.addToStatusArea('clipmate', this._indicator);
                
                // Create popup menu
                this._popupMenu = new ClipPopupMenu();
                this._indicator._popupMenu = this._popupMenu;
                this._popupMenu._panelMenu = this._indicator;
                
                // Set up keyboard shortcuts
                if (settings) {
                    this._setupKeybindings(ENABLE_KEYBINDING);
                }
                
                // Add direct keyboard event handler for Alt+Space
                keyPressEventId = global.stage.connect('key-press-event', 
                    this._onKeyPressed.bind(this));
                
                log('ClipMate: Extension enabled with keyboard shortcuts');
            } catch (e) {
                log(`ClipMate: Error in enable callback: ${e}`);
            }
        });
    }

    disable() {
        log('ClipMate: Disabling extension');
        
        // Save clipboard history
        Utils.writeRegistry(clipHistory);
        
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        
        if (this._popupMenu) {
            this._popupMenu.destroy();
            this._popupMenu = null;
        }
        
        // Remove keybindings
        this._removeKeybindings();
        
        // Disconnect key press handler
        if (keyPressEventId) {
            global.stage.disconnect(keyPressEventId);
            keyPressEventId = null;
        }
        
        // Disconnect settings
        if (settings && this._settingsChangedId) {
            settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        
        settings = null;
    }
}

function init() {
    log('ClipMate: Initializing');
    return new Extension();
} 