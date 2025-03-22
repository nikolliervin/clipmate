const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Settings fields
const Fields = {
    HISTORY_SIZE: 'history-size',
    TOPBAR_PREVIEW_SIZE: 'topbar-preview-size',
    NOTIFY_ON_COPY: 'notify-on-copy',
    CONFIRM_ON_CLEAR: 'confirm-clear',
    ENABLE_KEYBINDING: 'enable-keybindings',
    TOGGLE_MENU: 'toggle-clipboard-menu',
    DEBUG_MODE: 'debug-mode'
};

// Schema name
const SCHEMA_NAME = 'org.gnome.shell.extensions.clipmate';

// Get settings schema
function getSchema() {
    let schemaDir = Me.dir.get_child('schemas').get_path();
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
        schemaDir,
        Gio.SettingsSchemaSource.get_default(),
        false
    );
    let schema = schemaSource.lookup(SCHEMA_NAME, false);

    return new Gio.Settings({ settings_schema: schema });
}

// Initialize settings
function init() {
}

// Build the preferences widget
function buildPrefsWidget() {
    let settings = getSchema();
    let prefsWidget = new Gtk.Grid({
        margin_top: 10,
        margin_bottom: 10,
        margin_start: 10,
        margin_end: 10,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    // Create UI components
    let row = 0;

    // History size setting
    let historySizeLabel = new Gtk.Label({
        label: 'History Size:',
        halign: Gtk.Align.START,
        visible: true
    });
    
    let historySizeSpinner = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower: 5,
            upper: 50,
            step_increment: 1
        }),
        halign: Gtk.Align.END,
        visible: true
    });
    
    settings.bind(
        Fields.HISTORY_SIZE,
        historySizeSpinner,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );
    
    prefsWidget.attach(historySizeLabel, 0, row, 1, 1);
    prefsWidget.attach(historySizeSpinner, 1, row, 1, 1);
    row++;

    // Topbar preview size setting
    let topbarPreviewSizeLabel = new Gtk.Label({
        label: 'Topbar Preview Size:',
        halign: Gtk.Align.START,
        visible: true
    });
    
    let topbarPreviewSizeSpinner = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower: 5,
            upper: 100,
            step_increment: 1
        }),
        halign: Gtk.Align.END,
        visible: true
    });
    
    settings.bind(
        Fields.TOPBAR_PREVIEW_SIZE,
        topbarPreviewSizeSpinner,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );
    
    prefsWidget.attach(topbarPreviewSizeLabel, 0, row, 1, 1);
    prefsWidget.attach(topbarPreviewSizeSpinner, 1, row, 1, 1);
    row++;

    // Notify on copy setting
    let notifyOnCopyLabel = new Gtk.Label({
        label: 'Show notification on copy:',
        halign: Gtk.Align.START,
        visible: true
    });
    
    let notifyOnCopySwitch = new Gtk.Switch({
        active: false,
        halign: Gtk.Align.END,
        visible: true
    });
    
    settings.bind(
        Fields.NOTIFY_ON_COPY,
        notifyOnCopySwitch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    
    prefsWidget.attach(notifyOnCopyLabel, 0, row, 1, 1);
    prefsWidget.attach(notifyOnCopySwitch, 1, row, 1, 1);
    row++;

    // Confirm on clear setting
    let confirmOnClearLabel = new Gtk.Label({
        label: 'Confirm before clearing history:',
        halign: Gtk.Align.START,
        visible: true
    });
    
    let confirmOnClearSwitch = new Gtk.Switch({
        active: true,
        halign: Gtk.Align.END,
        visible: true
    });
    
    settings.bind(
        Fields.CONFIRM_ON_CLEAR,
        confirmOnClearSwitch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    
    prefsWidget.attach(confirmOnClearLabel, 0, row, 1, 1);
    prefsWidget.attach(confirmOnClearSwitch, 1, row, 1, 1);
    row++;

    // Enable keybinding setting
    let enableKeybindingLabel = new Gtk.Label({
        label: 'Enable keyboard shortcuts:',
        halign: Gtk.Align.START,
        visible: true
    });
    
    let enableKeybindingSwitch = new Gtk.Switch({
        active: true,
        halign: Gtk.Align.END,
        visible: true
    });
    
    settings.bind(
        Fields.ENABLE_KEYBINDING,
        enableKeybindingSwitch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    
    prefsWidget.attach(enableKeybindingLabel, 0, row, 1, 1);
    prefsWidget.attach(enableKeybindingSwitch, 1, row, 1, 1);
    row++;

    // Debug mode setting
    let debugModeLabel = new Gtk.Label({
        label: 'Enable debug mode:',
        halign: Gtk.Align.START,
        visible: true
    });
    
    let debugModeSwitch = new Gtk.Switch({
        active: false,
        halign: Gtk.Align.END,
        visible: true
    });
    
    settings.bind(
        Fields.DEBUG_MODE,
        debugModeSwitch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    
    prefsWidget.attach(debugModeLabel, 0, row, 1, 1);
    prefsWidget.attach(debugModeSwitch, 1, row, 1, 1);
    row++;

    // Keyboard shortcut setting info
    let shortcutInfoLabel = new Gtk.Label({
        label: 'Keyboard shortcuts can be changed in Settings > Keyboard > Shortcuts > Extensions',
        halign: Gtk.Align.START,
        wrap: true,
        visible: true
    });
    
    prefsWidget.attach(shortcutInfoLabel, 0, row, 2, 1);

    // No need for show_all() in GTK4, we set visible: true for each widget
    return prefsWidget;
} 