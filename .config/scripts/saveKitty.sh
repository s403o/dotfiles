#!/bin/bash
# This script is used to save and run kitty sessions.

USER=$(whoami)
MY_BASE_PATH="/home/$USER/.config/kitty-save-session/"
DUMP_FILE="$MY_BASE_PATH/kitty-dump.json"
CONVERT_SCRIPT_PATH="$MY_BASE_PATH/kitty-convert-dump.py"
SESSIONS_DIR="$MY_BASE_PATH/sessions"
SESSION_FILE_PREFIX="kitty-session"

save_kitty_session() {
    # Find the next available session number
    COUNTER=1
    while [[ -e "$SESSIONS_DIR/$SESSION_FILE_PREFIX-$COUNTER.kitty" ]]; do
        ((COUNTER++))
    done

    # Create the session file
    SESSION_FILE="$SESSION_FILE_PREFIX-$COUNTER.kitty"

    # Dump the current kitty session:
    kitty @ ls >"$DUMP_FILE"

    # Convert this JSON file into a kitty session file:
    cat "$DUMP_FILE" | python3 "$CONVERT_SCRIPT_PATH" > "$SESSIONS_DIR/$SESSION_FILE"

    # # Start kitty from that session file:
    # kitty --session "$SESSIONS_DIR/$SESSION_FILE" &
    clear
}

run_kitty_session() {
    # Prompt the user for a custom session name
    read -p "Enter the session name: " CUSTOM_SESSION_NAME

    # Use the custom session name if provided, otherwise find the next available session number
    if [ -n "$CUSTOM_SESSION_NAME" ]; then
        SESSION_FILE="$SESSION_FILE_PREFIX-$CUSTOM_SESSION_NAME.kitty"
    else
        # Find the next available session number
        COUNTER=1
        while [[ -e "$SESSIONS_DIR/$SESSION_FILE_PREFIX-$COUNTER.kitty" ]]; do
            ((COUNTER++))
        done

        # Create the session file
        SESSION_FILE="$SESSION_FILE_PREFIX-$COUNTER.kitty"
    fi

    # Start kitty from that session file:
    kitty --session "$SESSIONS_DIR/$SESSION_FILE" &
    clear
}

main() {
    echo "Choose an action:"
    echo "1. Save a kitty session"
    echo "2. Run a kitty session"
    read -p "Enter the option (1 or 2): " OPTION

    case $OPTION in
        1)
            save_kitty_session
            ;;
        2)
            run_kitty_session
            ;;
        *)
            echo "Invalid option. Please enter 1 or 2."
            main
            ;;
    esac
}

# Call the main function
main