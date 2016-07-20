let vars = {};

let helpMessage = `\
*Spades prompt*
Command list:
help:              display this message
set [var] [value]: set the value of var
get [var]:         get the value of var
list [var]:        list all possible options for var
build              builds the project using the current build system`

function list(x) {
    let str = "Options:\n";

    if (x instanceof Array) {
        // []
        x.forEach((v) => {
            str += "    " + v + "\n";
        });

    } else {
        // {}
        Object.keys(x).forEach((v) => {
            str += "    " + v + "\n";
        });
    }

    return str;
}

let promptCommands = {
    set: ([vname, val], spades) => {
        if (!vname | !val)
            return spades.log("Usage: set [var] [value]", "SET");

        switch (vname) {
            case "mode":
                spades.editor.getSession().setMode("ace/mode/" + val);
                break;

            case "theme":
                spades.setTheme("ace/theme/" + val);
                break;

            case "build":
                if (spades.builds[val])
                    spades.build = spades.builds[val]
                else
                    spades.log(`Build '${val}' doesn't exist`, "SET")
                break;

            default:
                vars[vname] = val;
                break;
        }
    },

    get: ([vname], spades) => {
        if (!vname)
            return spades.log("Usage: get [var]", "GET");

        switch (vname) {
            case "mode":
                let mode = spades.editor.getSession().getMode().$id;
                spades.log(mode.replace("ace/mode/", ""), "GET");
                break;

            case "theme":
                spades.log(spades.editor.getTheme().replace("ace/theme/", ""), "GET");
                break;

            case "build":
                spades.log(spades.build, "GET");
                break;

            default:
                spades.log(vars[vname], "GET");
                break;
        }
    },

    list: ([vname], spades) => {
        switch (vname) {
            case "mode":
                spades.log(list(spades.modeList), "LIST");
                break;

            case "theme":
                spades.log(list(spades.themeList), "LIST");
                break;

            case "build":
                spades.log(list(spades.builds), "LIST");
                break;

            default:
                spades.log("Usage: list [mode|theme|build]", "LIST");
                break;
        }
    },

    build: (_, spades) => {
        spades.doBuild();
    },

    help: (_, spades) => {
        spades.log(helpMessage, "HELP")
    }
}

function execPromptCmd(cmdStr, spades) {
    let words = cmdStr.split(" ");
    let cmd = words[0];
    let args = words.splice(1);

    if (promptCommands[cmd]) {
        //Cmd exists
        return promptCommands[cmd](args, spades);
    } else {
        return `Command '${cmd}' doesn't exist`;
    }
}

module.exports = execPromptCmd;