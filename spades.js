/* REQUIRES */
let fs = require('fs'); //File system module
let path = require('path'); //Path module
let spawn = require('child_process').spawn; //For builds

let ipcRenderer = require('electron').ipcRenderer; //IpcRenderer (to communicate with the main process)

let fileExtensions = require('./file-extensions.json'); //File extensions associated with syntax modes
let execPromptCmd = require('./prompt-commands.js');


let spades; //spades global instance


/* HELPER FUNCTIONS */
let $id = (id) => document.getElementById(id);

fs.existsSync = (path) => {
    //Check if file exists function
    try {
        fs.statSync(path);
    } catch(err) {
        return false;
    }
    return true;
};

/*COMMANDS*/
let commands = {
    'file-open': {
        exec: () => {
            //Send file open signal to main process
            ipcRenderer.send('file-open');
        },
        readOnly: true
    },
    
    'file-save': {
        exec: () => {
            //Save file
            if (spades.hasFile) {
                let err = spades.file.save(spades.editor.getValue());
                if (err)
                    spades.log("Couldn't save file: " + err, "ERROR");
            }
        },
        readOnly: false
    },
    
    'prompt-open': {
        exec: () => {
            //Open prompt
            spades.inPrompt = true;
            spades.infoBar.setReadOnly(false);
            spades.infoBar.focus();
            spades.infoBar.navigateFileEnd();
            spades.infoBar.scrollPageDown();

        },
        readOnly: true
    },

    'prompt-exec': {
        exec: () => {
            //Execute command in prompt
            if (spades.inPrompt) {
                let cmd = spades.infoBar.getSession() //Get contents of last line
                    .getLine(spades.infoBar.getSession().getLength()-1);

                spades.infoBar.setValue(spades.infoBar.getValue() + '\n');

                //Exit prompt
                spades.inPrompt = false;
                spades.infoBar.setReadOnly(true);

                //Execute prompt command
                let err = execPromptCmd(cmd, spades);
                if (err)
                    spades.log(err, "ERROR");
            }

            else if (spades.editor.isFocused())
                spades.editor.insert('\n');
        },
        readOnly: true
    },

    'build': {
        exec: () => {
            spades.doBuild();
        },
        readOnly: true
    },

    'reload': {
        exec: () => {
            //Reload config
            spades.loadConfig('*');
        },
        readOnly: true
    }
};

/*CLASS DECLARATIONS*/
class File {
    //TODO: try to use read and write streams
    constructor(path) {
        /*
        this.readStream = fs.createReadStream(path, {encoding: 'utf8'});
        this.writeStream = fs.createWriteStream(path, {encoding: 'utf8'});

        this.size = fs.statSync(this.path).size;
        */
        this.path = path;
        this.orig = this.read();
    }

    read() {
        /*
        let data = this.readStream.read(this.size);
        spades.log(data);
        */
        let data;
        try {
            data = fs.readFileSync(this.path, {encoding: 'utf8'});
        } catch(err) {
            spades.log("Error reading file: " + err, "ERROR");
            throw err;
        }
        return data;
    }

    save(what) {
        /*
        this.writeStream.write(what, 'utf8', () => {});
        */
        try {
            fs.writeFileSync(this.path, what);
            this.orig = what;
        } catch(err) {
            return err;
        }
    }
    /*
    get path() {
        return this.readStream.path;
    }
    */
}

class Spades {
    //Main spades editor class
    constructor() {
        this.log("Config file path is " + this.configPath);

        this.hasFile = false;
        this.inPrompt = false;

        this.editor = ace.edit("editor");
        this.editor.setReadOnly(true);
        this.editor.$blockScrolling = Infinity;
        this.editor.getSession().setUseWrapMode(true);

        this.infoBar = ace.edit("infobar");
        this.infoBar.setReadOnly(true);
        this.infoBar.getSession().setUseWrapMode(true);
        this.infoBar.$blockScrolling = Infinity;
        this.infoBar.setScrollSpeed(0.5);

        this.modeList = [];
        this.themeList = [];

        fs.readdir("ace-min-noconflict", (err, files) => {
            if (err)
                return spades.log("Cannot read ace directory", "ERROR");

            files.forEach((f) => {
                if (/mode-/.test(f))
                    this.modeList.push(f.replace(/mode-(.+)\.js/, "$1"));

                else if (/theme-/.test(f))
                    this.themeList.push(f.replace(/theme-(.*)\.js/, "$1"));

            });
        });

        this.configDefaults = {
            keymaps: {
                "file-open": "$C-O",
                "file-save": "$C-S",
                "prompt-open": "$C-Space",
                "prompt-exec": "Enter",
                "build": "$C-B",
                "reload": "$C-R"
            },
            style: {},
            builds: {}
        };

        this.loadConfig('*'); //Load all configuration

        for (let name in commands) {
            //Add commands
            let cmd = {
                name: name,
                bindKey: {
                    win: this.keymaps[name].replace('$C', 'Ctrl'),
                    mac: this.keymaps[name].replace('$C', 'Command')
                },
                exec: commands[name].exec,
                readOnly: commands[name].readOnly
            };

            this.editor.commands.addCommand(cmd);
            this.infoBar.commands.addCommand(cmd);
        }

        setInterval((_this) => {
            //Checks if file is saved
            if (_this.hasFile && !_this.fileSaved)
                document.title = `${_this.filePath} * - spades`;
            else
                document.title = `${_this.filePath} - spades`;
        }, 1000, this);
    }

    loadConfig(cfgName) {
        if (cfgName == '*') {
            //Load all configs
            this.loadConfig("style");
            this.loadConfig("keymaps");
            this.loadConfig("builds");
            return;
        }

        if (!fs.existsSync(this.configPath))
            //Create config directory if it doesn't exist
            fs.mkdirSync(this.configPath);

        let configFile = path.join(this.configPath, cfgName + '.json');

        let cfg = this.configDefaults[cfgName]; //Load default configuration

        if (!fs.existsSync(configFile))
            //File doesn't exist
            fs.writeFileSync(configFile, JSON.stringify(cfg));

        else {
            //File exists
            let data = fs.readFileSync(configFile, {encoding: 'utf8'});
            try {
                //Overwrite default values
                let json = JSON.parse(data);
                let keys = Object.keys(json);
                keys.forEach((key) => {
                    cfg[key] = json[key];
                });

            } catch(err) {
                //Error while parsing Jason
                this.log(`${err} (in ${cfgName}.json)`, "ERROR");
            }
        }

        switch (cfgName) {
            case "style":
                let theme = `ace/theme/${cfg.theme}`;
                this.log("Set theme " + theme);
                this.setTheme(theme);

                //Set css
                if (cfg.css) {
                    let style = $id("editor").style;

                    for(let s in cfg.css){
                        style[s] = cfg.css[s];
                    }

                    $id("infobar").style.fontSize = style.fontSize;
                }
                break;

            case "keymaps":
                this.keymaps = cfg;
                break;

            case "builds":
                this.builds = cfg;
                this.build = Object.keys(this.builds)[0];
                break;
        }
    }

    doBuild() {
        let cmd = this.buildCmd.replace("$f", this.filePath).split(" ");
        let arg = cmd.splice(1);

        let child = spawn(cmd[0], arg);

        child.on('error', (err) => {
            this.log(err, "BUILD");
        });

        child.stdout.on('data', (data) => {
            this.log(data, "BUILD");
        });

        child.stderr.on('data', (data) => {
            this.log(data, "BUILD");
        });

        child.on('close', (code) => {
            this.log(`${cmd} finished with exit code ${code}`, "BUILD");
        });
    }

    setTheme(path) {
        this.editor.setTheme(path);
        this.infoBar.setTheme(path);
    }

    log(what, type) {
        //prints to electron console, stdout and infobar
        let msg = `[${type || "INFO"}] ${what}`;
        process.stdout.write(msg + '\n');
        console.log(msg);
        if (this.infoBar) {
            this.infoBar.setValue(this.infoBar.getValue() + msg + '\n');
            //Scroll to bottom
            this.infoBar.navigateFileEnd();
            this.infoBar.scrollToRow(this.infoBar.getLastVisibleRow());
        }
    }

    get buildCmd() {
        return this.builds[this.build];
    }

    get filePath() {
        return this.hasFile ? this.file.path : "No File";
    }

    get fileSaved() {
        return this.file.orig === this.editor.getValue();
    }

    get configPath() {
        //Determine configuration files path

        if(process.platform === 'win32')
            //Windows
            return path.join(process.env.appdata, "spades");
        else
            //Mac, linux, bsd, etc
            return path.join(process.env.HOME, ".spades");
    }
}

ipcRenderer.on('file-opened', (event, filename) => {
    //When the main process has opened a file
    spades.log("Open file: " + filename);

    spades.file = new File(filename);
    spades.hasFile = true;

    spades.editor.setReadOnly(false);
    spades.editor.setValue(spades.file.read()); //Set text to file's text
    spades.editor.gotoLine(1); //Go to first line

    let matches = 
        /(\.[^.]+)$/g //Regex that matches file extension with the dot
        .exec(filename.toLowerCase());

    let fileExtension = matches !== null
        ? matches[0].substring(1) //Remove the dot
        : "txt";

    let mode = fileExtensions[fileExtension] || "plain_text";

    spades.log("Set mode " + mode);
    spades.editor.getSession().setMode("ace/mode/" + mode);
});

(() => {
    //Main function
    spades = new Spades();
})();