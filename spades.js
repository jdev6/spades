/* REQUIRES */
let fs = require('fs'); //File system module
let path = require('path'); //Path module

let {ipcRenderer} = require('electron'); //IpcRenderer (to communicate with the main process)

let fileExtensions = require('./file-extensions.json'); //File extensions associated with syntax modes

/* HELPER FUNCTIONS */
let logstdout = (what) => {
    //prints to electron console and stdout (chromium console and terminal)
    process.stdout.write(what + '\n');
    console.log(what);
};

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
        exec: (editor) => {
            //Send file open signal to main process
            ipcRenderer.send('file-open');
        },
        readOnly: true
    },
    
    'file-save': {
        exec: (editor) => {
            //Save file
            if (spades.hasFile) {
                let err = spades.file.save(spades.editor.getValue());
                if (err)
                    logstdout("Couldn't save file: " + err);
            }
        },
        readOnly: false
    },
    
    'reload': {
        exec: (editor) => {
            //Reload config
            spades.loadConfig('*');
        },
        readOnly: true
    }/*,

    'file-next': {
        exec: (editor) => {
            //Next file
            logstdout("Next "+ spades.fileNum+1);
            spades.fileNum++;
            spades.editor.setValue(spades.currentFile.read());
        },
        readOnly: true
    },

    'file-prev': {
        exec: (editor) => {
            //Previous file
            spades.fileNum--;
        },
        readOnly: true
    }*/
}

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
        logstdout(data);
        */
        let data;
        try {
            data = fs.readFileSync(this.path, {encoding: 'utf8'});
        } catch(err) {
            logstdout("Error reading file: " + err);
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

let spades; //spades global instance

class Spades {
    //Main spades editor class
    constructor() {
        logstdout("Config file path is " + this.configPath);

        this.hasFile = false;

        this.editor = ace.edit("editor");
        this.editor.setReadOnly(true);
        this.editor.$blockScrolling = Infinity;

        /*this.infoBar = ace.edit("infobar");
        this.infoBar.setReadOnly(true);
        $id("infobar").style.position = "absolute";
        $id("infobar").style.top = 60
        $id("infobar").style.height = "20px";
        $id("infobar").style.width = this.editor.getSession().getScreenWidth();*/

        this.configDefaults = {
            keymaps: {
                'file-open': '$C-O',
                'file-save': '$C-S',
                'reload': '$C-R'/*,
                'file-next': '$C-Tab',
                'file-prev': '$C-Shift-Tab',*/
            },
            style: {},
            builds: {}
        };

        this.loadConfig('*'); //Load all configuration

        for (let cmd in commands) {
            this.editor.commands.addCommand({
                name: cmd,
                bindKey: {
                    win: this.keymaps[cmd].replace('$C', 'Ctrl'),
                    mac: this.keymaps[cmd].replace('$C', 'Command')
                },
                exec: commands[cmd].exec,
                readOnly: commands[cmd].readOnly
            });
        }

        setInterval((self) => {
            if (self.hasFile && !spades.fileSaved)
                document.title = `${self.filePath} * - spades`;
            else
                document.title = `${self.filePath} - spades`;
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

        let cfg;

        if (!fs.existsSync(configFile)) {
            //File doesn't exist
            cfg = this.configDefaults[cfgName];
            fs.writeFileSync(configFile, JSON.stringify(cfg));

        } else {
            //File exists
            let data = fs.readFileSync(configFile, {encoding: 'utf8'});
            try {
                cfg = JSON.parse(data);
            } catch(err) {
                throw `${err} (in ${cfgName})`;
            }
        }

        switch (cfgName) {
            case "style":
                let theme = `ace/theme/${cfg.theme}`;
                logstdout("Set theme " + theme);
                this.setTheme(theme);

                //Set css
                if (cfg.css) {
                    let style = $id("editor").style;

                    for(let s in cfg.css){
                        style[s] = cfg.css[s];
                    }
                }
                break;

            case "keymaps":
                this.keymaps = cfg;
                break;
        }
    }

    setTheme(path) {
        this.editor.setTheme(path);
        //this.infoBar.setTheme(path);
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
    logstdout("Open file: " + filename);

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

    let mode = "ace/mode/" + (fileExtensions[fileExtension] || "plain_text");

    logstdout("Set mode " + mode);
    spades.editor.getSession().setMode(mode);
});

(() => {
    //Main function
    spades = new Spades();
})();