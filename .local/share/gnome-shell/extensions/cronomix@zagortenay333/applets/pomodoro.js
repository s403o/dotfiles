const _ME = imports.misc.extensionUtils.getCurrentExtension();

const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;

const Misc = _ME.imports.utils.misc;
const { ScrollBox } = _ME.imports.utils.scroll;
const { Markup } = _ME.imports.utils.markup.renderer;
const { EditorView } = _ME.imports.utils.markup.editor;
const { show_confirm_popup } = _ME.imports.utils.popup;
const { _, Row, unreachable, Me } = _ME.imports.utils.misc;
const { Storage } = _ME.imports.utils.storage;
const { Button, ButtonBox, CheckBox } = _ME.imports.utils.button;
const { Time, get_time_ms } = _ME.imports.utils.time;
const { TimePicker, IntPicker, Dropdown } = _ME.imports.utils.pickers;
const { Applet, PanelPosition, PanelPositionTr } = _ME.imports.applets.applet;

class Preset {
    text = '';
    pomodoro_length = 25 * 60000;
    short_break_length = 5 * 60000;
    long_break_length = 15 * 60000;
    long_break_after_n_pomos = 4;
}

const Phase = {
    pomodoro: _('Pomodoro'),
    long_break: _('Long Break'),
    short_break: _('Short Break'),
};

const storage_config = {
    file: '~/.config/cronomix/pomodoro.json',
    
    values: {
        show_panel_label: { tag: 'boolean', value: true },
        panel_position: { tag: 'enum', value: PanelPosition.RIGHT, enum: Object.values(PanelPosition) },
        notif_sound: { tag: 'file', value: Me.path + '/data/sounds/beeps.ogg', start: Me.path + '/data/sounds/' },
        clock_size: { tag: 'number', value: 0, range: [0, 2000] },
        open: { tag: 'keymap', value: null },
        show_presets: { tag: 'keymap', value: null },
        pomos_until_long_break: { tag: 'custom', value: 4 },
        completed_pomodoros: { tag: 'custom', value: 0 },
        presets: { tag: 'custom', value: Array() },
    },
    
    groups: [
        ['show_panel_label', 'panel_position', 'clock_size', 'notif_sound'],
        ['open', 'show_presets'],
    ],
    
    translations: {
        show_panel_label: _('Show time in panel'),
        panel_position: _('Panel position'),
        clock_size: _('Clock size (set to 0 for default size)'),
        notif_sound: _('Notification sound'),
        open: _('Open'),
        show_presets: _('Show presets'),
        ...PanelPositionTr,
    }
};

var PomodoroApplet = class PomodoroApplet extends Applet {
    time;
    preset;
    phase = 'pomodoro';
    storage = new Storage(storage_config);
    
    #tic_id = 0;
    #current_view = null;
    
    constructor(ext) {
        super(ext, 'pomodoro');
        
        this.storage.init_keymap({
            open: () => this.panel_item.menu.open(),
            show_presets: () => { this.panel_item.menu.open(); this.show_presets(); },
        });
        
        this.set_panel_position(this.storage.read.panel_position.value);
        this.storage.subscribe('panel_position', ({ value }) => this.set_panel_position(value));
        this.storage.subscribe('show_panel_label', ({ value }) => this.panel_label.visible = value && this.#tic_id > 0);
        this.set_preset();
        this.show_main_view();
    }
    
    destroy() {
        this.pause();
        this.storage.destroy();
        super.destroy();
    }
    
    #tic(prev) {
        const now = get_time_ms();
        prev ??= now;
        const new_time = this.time.total - (now - prev);
        
        if (new_time > 0) {
            this.time = new Time(new_time);
        }
        else {
            this.panel_item.menu.open();
            this.set_next_phase();
        }
        
        this.set_panel_label(this.time.fmt_hms(true));
        this.publish('tic', this.time);
        this.#tic_id = Mainloop.timeout_add_seconds(1, () => this.#tic(now));
    }
    
    is_timer_running() {
        return this.#tic_id > 0;
    }
    
    start() {
        if (this.storage.read.show_panel_label.value)
            this.panel_label.show();
        this.publish('timer_state_changed', true);
        this.#tic();
    }
    
    pause() {
        this.panel_label.hide();
        if (this.#tic_id) {
            Mainloop.source_remove(this.#tic_id);
            this.#tic_id = 0;
        }
        this.publish('timer_state_changed', false);
    }
    
    set_phase(phase, pause = true) {
        if (pause)
            this.pause();
        
        this.phase = phase;
        
        switch (phase) {
            case 'pomodoro':
                this.time = new Time(this.preset.pomodoro_length);
                break;
            case 'long_break':
                this.time = new Time(this.preset.long_break_length);
                break;
            case 'short_break':
                this.time = new Time(this.preset.short_break_length);
                break;
            default: unreachable(phase);
        }
        
        this.publish('phase_changed', this.phase);
    }
    
    set_next_phase() {
        let next_phase;
        
        if (this.phase !== 'pomodoro') {
            next_phase = 'pomodoro';
        }
        else if (this.storage.read.pomos_until_long_break.value === 1) {
            next_phase = 'long_break';
            this.storage.modify('completed_pomodoros', v => v.value++);
            this.storage.modify('pomos_until_long_break', v => v.value = this.preset.long_break_after_n_pomos);
        }
        else {
            next_phase = 'short_break';
            this.storage.modify('completed_pomodoros', v => v.value++);
            this.storage.modify('pomos_until_long_break', v => v.value--);
        }
        
        this.set_phase(next_phase, false);
        const sound_file = this.storage.read.notif_sound.value;
        if (sound_file)
            Misc.play_sound(sound_file);
    }
    
    set_preset(preset) {
        this.pause();
        this.preset = preset ?? this.storage.read.presets.value[0] ?? new Preset();
        this.time = new Time(this.preset.pomodoro_length);
        const idx = this.storage.read.presets.value.indexOf(this.preset);
        if (idx !== -1)
            this.storage.modify('presets', x => Misc.array_swap(x.value, 0, idx));
    }
    
    delete_preset(preset) {
        this.storage.modify('presets', x => Misc.array_remove(x.value, preset));
        if (this.preset === preset)
            this.set_preset();
    }
    
    show_main_view() {
        this.#current_view?.destroy();
        const view = new MainView(this);
        this.#current_view = view;
        this.menu.add_actor(view.actor);
    }
    
    show_presets() {
        this.#current_view?.destroy();
        const view = new PresetsView(this);
        this.#current_view = view;
        this.menu.add_actor(view.actor);
    }
    
    show_preset_editor(preset) {
        this.#current_view?.destroy();
        const view = new PresetEditor(this, preset);
        this.#current_view = view;
        this.menu.add_actor(view.actor);
    }
    
    show_settings() {
        this.#current_view?.destroy();
        const view = this.storage.render(() => this.show_main_view());
        this.#current_view = view;
        this.menu.add_actor(view);
    }
}

class MainView {
    actor;
    
    #sid1;
    #sid2;
    #sid3;
    #applet;
    
    constructor(applet) {
        this.#applet = applet;
        this.actor = new St.BoxLayout({ vertical: true, style_class: 'cronomix-spacing' });
        
        //
        // Header
        //
        const header_buttons = new ButtonBox();
        const presets_button = header_buttons.add({ icon: 'cronomix-hamburger-symbolic' });
        const settings_button = header_buttons.add({ icon: 'cronomix-wrench-symbolic' });
        const header = new Row('', header_buttons.actor, this.actor);
        
        header_buttons.actor.y_align = Clutter.ActorAlign.START;
        Misc.focus_when_mapped(settings_button.actor);
        header.label.style = 'font-weight: bold;';
        const clock_size = applet.storage.read.clock_size.value;
        if (clock_size > 0)
            header.label.style += `font-family: monospace; font-size: ${clock_size}px;`;
        
        //
        // phase info box
        //
        const phase_info = new St.BoxLayout({ vertical: true, style_class: 'cronomix-group' });
        this.actor.add_actor(phase_info);
        
        const phase_dropdown = new Dropdown(applet.phase, Object.keys(Phase), Object.values(Phase));
        new Row(_('Phase'), phase_dropdown.actor.actor, phase_info);
        
        const pomodoro_counter = new IntPicker(0, Number.MAX_SAFE_INTEGER);
        new Row(_('Completed pomodoros'), pomodoro_counter.actor, phase_info);
        
        const long_break_counter = new IntPicker(1, Number.MAX_SAFE_INTEGER);
        new Row(_('Pomodoros until long break'), long_break_counter.actor, phase_info);
        
        //
        // buttons
        //
        const button_box = new ButtonBox(this.actor);
        const start_button = button_box.add({ wide: true, label: _('Start') });
        const pause_button = button_box.add({ wide: true, label: _('Pause') });
        
        //
        // ui update
        //
        const on_phase_changed = (phase) => {
            header.label.set_text(applet.time.fmt_hms(true));
            header.label.remove_style_class_name('cronomix-red');
            header.label.remove_style_class_name('cronomix-green');
            header.label.add_style_class_name(phase === 'pomodoro' ? 'cronomix-red' : 'cronomix-green');
            pomodoro_counter.set_value(applet.storage.read.completed_pomodoros.value);
            long_break_counter.set_value(applet.storage.read.pomos_until_long_break.value);
            phase_dropdown.set_value(phase);
        };
        
        const on_timer_state_changed = (running) => {
            if (running) {
                pause_button.actor.grab_key_focus();
                pause_button.actor.visible = true;
                start_button.actor.visible = false;
            }
            else {
                start_button.actor.grab_key_focus();
                pause_button.actor.visible = false;
                start_button.actor.visible = true;
            }
        };
        
        on_phase_changed(applet.phase);
        on_timer_state_changed(applet.is_timer_running());
        
        //
        // listen
        //
        start_button.subscribe('left_click', () => applet.start());
        pause_button.subscribe('left_click', () => applet.pause());
        settings_button.subscribe('left_click', () => applet.show_settings());
        presets_button.subscribe('left_click', () => applet.show_presets());
        phase_dropdown.on_change = (phase) => applet.set_phase(phase);
        this.#sid1 = applet.subscribe('tic', (time) => header.label.set_text(time.fmt_hms(true)));
        this.#sid3 = applet.subscribe('phase_changed', (phase) => on_phase_changed(phase));
        this.#sid2 = applet.subscribe('timer_state_changed', (running) => on_timer_state_changed(running));
        pomodoro_counter.on_change = (value, valid) => { if (valid)
            applet.storage.modify('completed_pomodoros', v => v.value = value); };
        long_break_counter.on_change = (value, valid) => { if (valid)
            applet.storage.modify('pomos_until_long_break', v => v.value = value); };
    }
    
    destroy() {
        this.#applet.unsubscribe(this.#sid1);
        this.#applet.unsubscribe(this.#sid2);
        this.#applet.unsubscribe(this.#sid3);
        this.actor.destroy();
    }
}

class PresetsView {
    actor;
    
    constructor(applet) {
        this.actor = new St.BoxLayout({ vertical: true, style_class: 'cronomix-spacing' });
        
        const presets = applet.storage.read.presets.value;
        
        if (presets.length) {
            const scrollbox = new ScrollBox();
            this.actor.add_actor(scrollbox.actor);
            for (const preset of presets)
                scrollbox.box.add_actor(new PresetCard(applet, preset).actor);
        }
        
        const button_box = new ButtonBox(this.actor);
        const ok_button = button_box.add({ wide: true, label: _('Ok') });
        const add_button = button_box.add({ wide: true, label: _('Add Preset') });
        
        ok_button.subscribe('left_click', () => applet.show_main_view());
        add_button.subscribe('left_click', () => applet.show_preset_editor());
        
        Misc.focus_when_mapped(ok_button.actor);
    }
    
    destroy() {
        this.actor.destroy();
    }
}

class PresetCard extends Misc.Card {
    constructor(applet, preset) {
        super();
        
        const checkbox = new CheckBox({ parent: this.left_header_box, checked: applet.preset === preset });
        const edit_button = new Button({ parent: this.autohide_box, icon: 'cronomix-edit-symbolic', style_class: 'cronomix-floating-button' });
        const delete_button = new Button({ parent: this.autohide_box, icon: 'cronomix-trash-symbolic', style_class: 'cronomix-floating-button' });
        
        if (preset.text)
            this.actor.add_actor(new Markup(preset.text).actor);
        
        edit_button.subscribe('left_click', () => applet.show_preset_editor(preset));
        checkbox.subscribe('left_click', () => { applet.set_preset(preset); applet.show_main_view(); });
        delete_button.subscribe('left_click', () => {
            show_confirm_popup(delete_button, () => { applet.delete_preset(preset); applet.show_presets(); });
        });
    }
}

class PresetEditor extends EditorView {
    constructor(applet, preset) {
        super();
        
        this.main_view.entry.entry.set_text(preset?.text ?? '');
        
        const group = new St.BoxLayout({ vertical: true, style_class: 'cronomix-group' });
        this.main_view.left_box.add_actor(group);
        
        const pomo_picker = new TimePicker(new Time(preset?.pomodoro_length ?? 25 * 60000));
        new Row(_('Pomodoro length'), pomo_picker.actor, group);
        
        const sbreak_picker = new TimePicker(new Time(preset?.short_break_length ?? 5 * 60000));
        new Row(_('Short break length'), sbreak_picker.actor, group);
        
        const lbreak_picker = new TimePicker(new Time(preset?.long_break_length ?? 15 * 60000));
        new Row(_('Long break length'), lbreak_picker.actor, group);
        
        const cycles = new IntPicker(1, Number.MAX_SAFE_INTEGER, 4);
        new Row(_('Long break every n pomodoros'), cycles.actor, group);
        
        const button_box = new ButtonBox(this.main_view.left_box);
        const ok_button = button_box.add({ wide: true, label: _('Ok') });
        const cancel_button = button_box.add({ wide: true, label: _('Cancel') });
        
        cancel_button.subscribe('left_click', () => applet.show_presets());
        ok_button.subscribe('left_click', () => {
            if (preset)
                applet.storage.modify('presets', x => Misc.array_remove(x.value, preset));
            
            const new_preset = {
                text: this.main_view.entry.entry.text,
                pomodoro_length: pomo_picker.get_time().total,
                long_break_length: lbreak_picker.get_time().total,
                short_break_length: sbreak_picker.get_time().total,
                long_break_after_n_pomos: cycles.get_value(),
            };
            
            applet.storage.modify('presets', x => x.value.push(new_preset));
            applet.set_preset(new_preset);
            applet.show_presets();
        });
    }
    
    destroy() {
        this.actor.destroy();
    }
}
