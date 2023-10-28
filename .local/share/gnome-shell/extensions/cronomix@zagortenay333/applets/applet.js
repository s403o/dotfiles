const _ME = imports.misc.extensionUtils.getCurrentExtension();

const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const { Button: PanelButton } = imports.ui.panelMenu;

const Fs = _ME.imports.utils.fs;
const { _ } = _ME.imports.utils.misc;
const Ext = _ME.imports.extension;
const Misc = _ME.imports.utils.misc;
const { PubSub } = _ME.imports.utils.pubsub;
const { Button } = _ME.imports.utils.button;

var PanelPosition;
(function (PanelPosition) {
    PanelPosition["LEFT"] = "left";
    PanelPosition["CENTER"] = "center";
    PanelPosition["RIGHT"] = "right";
})(PanelPosition || (PanelPosition = {}));

var PanelPositionTr = {
    'left': _('Left'),
    'center': _('Center'),
    'right': _('Right'),
};

var Applet = class Applet extends PubSub {
    id;
    ext;
    menu;
    panel_icon;
    panel_label;
    panel_item;
    
    constructor(ext, id) {
        super();
        
        this.id = id;
        this.ext = ext;
        
        //
        // panel button
        //
        this.panel_item = new PanelButton(0.5, `cronomix-${id}-applet`);
        this.panel_item.add_style_class_name('cronomix-panel-button');
        
        const box = new St.BoxLayout();
        this.panel_item.add_actor(box);
        
        this.panel_icon = new St.Icon({ style_class: 'system-status-icon' });
        box.add_actor(this.panel_icon);
        
        this.panel_label = new St.Label({ visible: false, y_align: Clutter.ActorAlign.CENTER });
        box.add_actor(this.panel_label);
        
        this.set_panel_icon(`cronomix-${id}-symbolic`);
        
        //
        // menu
        //
        const wrapper = new Misc.CellBox(this.panel_item.menu.box);
        
        this.menu = new St.BoxLayout({ vertical: true });
        wrapper.cell.add_actor(this.menu);
        
        this.panel_item.menu.box.add_style_class_name('cronomix-menu');
        let context_menu = null;
        
        //
        // listen
        //
        this.panel_item.connect('captured-event', (_, event) => {
            if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                if (event.get_button() === Clutter.BUTTON_SECONDARY) {
                    this.menu.hide();
                    if (!context_menu) {
                        context_menu = new ContextMenu(this.ext);
                        wrapper.cell.add_actor(context_menu.actor);
                    }
                }
                else {
                    context_menu?.actor.destroy();
                    context_menu = null;
                    this.menu.show();
                }
            }
        });
        this.panel_item.menu.connect('open-state-changed', (_, state) => {
            if (state) {
                const area = Misc.get_monitor_work_area(this.panel_item.menu.actor);
                this.panel_item.menu.actor.style = `max-width: ${area.width - 6}px; max-height: ${area.height - 6}px`;
            }
        });
    }
    
    set_panel_position(position) {
        const idx = (position === PanelPosition.RIGHT) ? 0 : -1;
        delete Main.panel.statusArea[this.id];
        Main.panel.addToStatusArea(this.id, this.panel_item, idx, position);
    }
    
    set_panel_icon(icon_name) {
        this.panel_icon.gicon = Misc.get_icon(icon_name);
    }
    
    set_panel_label(str) {
        this.panel_label.set_text(str);
    }
    
    destroy() {
        this.panel_item.destroy();
    }
}

var ContextMenu = class ContextMenu {
    actor;
    
    constructor(ext) {
        this.actor = new St.BoxLayout({ vertical: true, x_expand: true });
        
        const items_box = new St.BoxLayout({ vertical: true });
        this.actor.add_actor(items_box);
        
        const settings_button = new Button({ parent: items_box, icon: 'cronomix-wrench-symbolic', label: _('Settings'), style_class: 'cronomix-menu-button' });
        const website_button = new Button({ parent: items_box, icon: 'cronomix-link-symbolic', label: _('Website'), style_class: 'cronomix-menu-button' });
        
        website_button.subscribe('left_click', () => Fs.open_web_uri_in_default_app(Misc.Me.metadata.url));
        settings_button.subscribe('left_click', () => {
            let settings_view;
            
            const done_fn = () => {
                settings_view.destroy();
                items_box.show();
            };
            
            const check_fn = () => {
                let n_enabled = 0;
                
                for (const [applet_name] of Ext.applets) {
                    const enabled = ext.storage.read[applet_name].value;
                    if (enabled)
                        n_enabled++;
                }
                
                return n_enabled ? '' : 'At least one applet must be enabled.';
            };
            
            settings_view = ext.storage.render(done_fn, check_fn);
            this.actor.add_actor(settings_view);
            items_box.hide();
        });
    }
}
