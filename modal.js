const St = imports.gi.St;
const GObject = imports.gi.GObject;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;

let _openModalDialog;

function openModal(title, message, ok_label, cancel_label, callback) {
  if (!_openModalDialog) {
    _openModalDialog = new Modal(title, message, ok_label, cancel_label, callback).open();
  }
}

const Modal = GObject.registerClass(
  class Modal extends ModalDialog.ModalDialog {
    _init(title, desc, ok_label, cancel_label, callback) {
      super._init();

      let main_box = new St.BoxLayout({
        vertical: false
      });
      this.contentLayout.add_child(main_box);

      let message_box = new St.BoxLayout({
        vertical: true
      });
      main_box.add_child(message_box);

      let subject_label = new St.Label({
        style: 'font-weight: bold',
        x_align: Clutter.ActorAlign.CENTER,
        text: title
      });
      message_box.add_child(subject_label);

      let desc_label = new St.Label({
        style: 'padding-top: 12px',
        x_align: Clutter.ActorAlign.CENTER,
        text: desc
      });
      message_box.add_child(desc_label);

      this.setButtons([
        {
          label: cancel_label,
          action: () => {
            this.close();
            _openModalDialog = null;
          },
          key: Clutter.Escape
        },
        {
          label: ok_label,
          action: () => {
            this.close();
            callback();
            _openModalDialog = null;
          }
        }
      ]);
    }
  }
);