const _ME = imports.misc.extensionUtils.getCurrentExtension();

const St = imports.gi.St;
const Cogl = imports.gi.Cogl;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const { Pixbuf } = imports.gi.GdkPixbuf;

const Fs = _ME.imports.utils.fs;
const { _ } = _ME.imports.utils.misc;
const { Button } = _ME.imports.utils.button;
const { show_info_popup } = _ME.imports.utils.popup;

var Image = class Image {
    actor;
    
    constructor(path, default_width, fixed_width) {
        try {
            if (path[0] === '~')
                path = GLib.get_home_dir() + path.slice(1);
            
            let width;
            
            if (fixed_width) {
                width = fixed_width;
            }
            else {
                [, width] = Pixbuf.get_file_info(path);
                if (width === 0)
                    throw 0;
                if (width > default_width)
                    width = default_width;
            }
            
            const p = Pixbuf.new_from_file_at_scale(path, width, -1, true);
            const format = p.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888;
            const content = St.ImageContent.new_with_preferred_size(p.width, p.height);
            content.set_bytes(p.read_pixel_bytes(), format, p.width, p.height, p.rowstride);
            
            this.actor = new St.Widget({ height: p.height, width: p.width });
            this.actor.set_content(content);
            this.actor.set_content_gravity(Clutter.ContentGravity.CENTER);
            this.actor.reactive = true;
            this.actor.connect('button-press-event', () => Fs.open_file_in_default_app(path));
            this.actor.connect('enter-event', () => global.display.set_cursor(Meta.Cursor.POINTING_HAND));
            this.actor.connect('leave-event', () => global.display.set_cursor(Meta.Cursor.DEFAULT));
        }
        catch (e) {
            const button = new Button({ icon: 'cronomix-issue-symbolic', label: _('Image not found'), style_class: 'cronomix-red' });
            button.subscribe('left_click', () => show_info_popup(button, '' + e));
            this.actor = button.actor;
        }
    }
}
