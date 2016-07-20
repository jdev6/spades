#Spades

Text editor built with [electron](http://electron.atom.io/) and [ace](https://ace.c9.io)

#Configuration

The path in which configuration files will be stored is:

    Windows: %appdata%/spades
    Everyting else: $HOME/.spades


Configuration files use the json format:

    style.json: {
        "theme": "an ace theme",
        "css": {
            //custom css here
            //for example:
            fontSize: "14px"
        }
    }

    keymaps.json: {
        //$C is used for Command in Mac and Ctrl in any other os
        "file-open": "$C-O",
        "file-save": "$C-S",
        "prompt-open": "$C-Space", //See #Prompt below
        "prompt-exec": "Enter",
        "build": "$C-B",
        "reload": "$C-R"
    }

    builds.json: {
        //Build systems
        //Example:
        "npm": "npm start run"    
    }

#Prompt

Spades features a prompt/infobar to issue commands.

You can access the prompt by pressing Ctrl/Command - Space (default keybinding)

The commands are:

    help:              display this message
    set [var] [value]: set the value of var
    get [var]:         get the value of var
    list [var]:        list all possible options for var
    build              builds the project using the current build system

Example:

    list theme
    [LIST] Options:
    ambiance
    chaos
    chrome
    clouds
    clouds_midnight
    cobalt
    crimson_editor
    dawn
    dreamweaver
    eclipse
    github
    idle_fingers
    iplastic
    katzenmilch
    kr_theme
    kuroir
    merbivore
    merbivore_soft
    mono_industrial
    monokai
    pastel_on_dark
    solarized_dark
    solarized_light
    sqlserver
    terminal
    textmate
    tomorrow
    tomorrow_night_blue
    tomorrow_night_bright
    tomorrow_night_eighties
    tomorrow_night
    twilight
    vibrant_ink
    xcode

    set mode javascript
    //Javascript syntax highlighting