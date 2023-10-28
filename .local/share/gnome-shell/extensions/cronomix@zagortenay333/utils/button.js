const _ME = imports.misc.extensionUtils.getCurrentExtension();

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Misc = _ME.imports.utils.misc;
const { PubSub } = _ME.imports.utils.pubsub;

var ButtonBox = class ButtonBox {
    actor;
    
    constructor(parent, homogeneous = true) {
        this.actor = new St.BoxLayout({ style_class: 'cronomix-button-box' });
        parent?.add_actor(this.actor);
        this.actor.layout_manager.homogeneous = homogeneous;
    }
    
    add(params = {}) {
        params.parent = this.actor;
        return new Button(params);
    }
}

var Button = class Button extends PubSub {
    actor;
    icon;
    label;
    
    #checked;
    
    constructor({ parent = null, icon = '', label = '', style_class = '', wide = false, centered = false, } = {}) {
        super();
        
        this.actor = new St.BoxLayout({ reactive: true, can_focus: true, track_hover: true, style_class: 'cronomix-button' });
        parent?.add_actor(this.actor);
        
        this.actor.x_expand = wide;
        if (centered)
            this.actor.x_align = Clutter.ActorAlign.CENTER;
        if (style_class)
            this.actor.add_style_class_name(style_class);
        if (icon)
            this.set_icon(icon);
        if (label)
            this.set_label(label);
        
        this.actor.connect('destroy', () => this.unsubscribe_all());
        this.actor.connect('scroll-event', (_, event) => this.#on_mouse_scroll(event));
        this.actor.connect('key-release-event', (_, event) => this.#on_key_release(event));
        this.actor.connect('button-release-event', (_, event) => this.#on_mouse_release(event));
    }
    
    set_icon(icon) {
        if (icon === '') {
            this.icon?.destroy();
            this.icon = null;
        }
        else if (this.icon) {
            this.icon.gicon = Misc.get_icon(icon);
        }
        else {
            this.icon = new St.Icon({ gicon: Misc.get_icon(icon) });
            this.actor.insert_child_at_index(this.icon, 0);
        }
    }
    
    set_label(label) {
        if (label === '') {
            this.label?.destroy();
            this.label = null;
        }
        else if (this.label) {
            this.label.set_text(label);
        }
        else {
            this.label = new St.Label({ x_expand: true, text: label, y_align: Clutter.ActorAlign.CENTER });
            this.actor.add_actor(this.label);
        }
    }
    
    get checked() {
        return !!this.#checked;
    }
    
    set checked(value) {
        if (value) {
            this.actor.add_style_pseudo_class('checked');
        }
        else {
            this.actor.remove_style_pseudo_class('checked');
        }
        
        this.#checked = value;
    }
    
    #on_key_release(event) {
        const s = event.get_key_symbol();
        
        if (s === Clutter.KEY_Return || s === Clutter.KEY_KP_Enter) {
            if (this.#checked !== undefined)
                this.checked = !this.checked;
            this.publish('left_click', null);
        }
    }
    
    #on_mouse_release(event) {
        if (this.#checked !== undefined)
            this.checked = !this.checked;
        
        switch (event.get_button()) {
            case Clutter.BUTTON_PRIMARY:
                this.publish('left_click', null);
                break;
            case Clutter.BUTTON_MIDDLE:
                this.publish('middle_click', null);
                break;
            case Clutter.BUTTON_SECONDARY:
                this.publish('right_click', null);
                break;
        }
    }
    
    #on_mouse_scroll(event) {
        const direction = event.get_scroll_direction();
        
        if (direction === Clutter.ScrollDirection.UP) {
            this.publish('scroll', -1);
        }
        else if (direction === Clutter.ScrollDirection.DOWN) {
            this.publish('scroll', 1);
        }
    }
}

var CheckBox = class CheckBox extends Button {
    constructor({ as_toggle = false, parent = null, label = '', style_class = '', checked = false, } = {}) {
        super({ parent, label, style_class });
        const bin = new St.Bin();
        this.actor.insert_child_at_index(bin, 0);
        this.actor.add_style_class_name(as_toggle ? 'cronomix-toggle toggle-switch' : 'cronomix-checkbox check-box');
        this.checked = checked;
    }
}
