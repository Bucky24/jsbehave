const {Builder, By, Key, until} = require('selenium-webdriver');
const fs = require("fs");
const { EOL } = require('os');

const fileName = process.argv[2];

const contents = fs.readFileSync(fileName, "utf-8");
const lines = contents.split(EOL);

const variables = {};

function getVariable(name) {
    return variables[name];
}

function driver() {
    return getVariable("jsbehave.driver");
}

function getSelector(selector) {
    const [type, ...other] = selector.split("=");

    const finalVal = other.join("=");

    if (type === "name") {
        return By.name(finalVal);
    } else if (type === "text") {
        return By.xpath(`//*[text()="${finalVal}"]`);
    } else if (type === "selector") {
        return By.css(finalVal);
    }
}

async function openBrowser([ browser ]) {
    const driver = await new Builder().forBrowser(browser).build();
    variables["jsbehave.driver"] = driver;
}

function goToPage([ url ]) {
    return driver().get(url);
}

const keyLookup = {
    "return": Key.RETURN,
};

function typeKeys([ string, selector ]) {
    const sel = getSelector(selector);

    const element = driver().findElement(sel);

    if (string.startsWith("\"") && string.endsWith("\"")) {
        string = string.substr(1, string.length-2);
    } else {
        string = keyLookup[string];
    }

    return element.sendKeys(string);
}

function waitForTitle([ title ]) {
    return driver().wait(until.titleIs(title), 5000)
}

function startTest([ test ]) {
    variables["jbehave.activeTest"] = test;
}

function endTest() {
    const test = variables["jbehave.activeTest"];

    console.log(`Test ${test} - SUCCESS`);
    delete variables["jbehave.activeTest"];
}

function clickElement([ selector ]) {
    const sel = getSelector(selector);
    const elem = driver().findElement(sel);
    return elem.click();
}

function sleep([ seconds ]) {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

function waitForElement([ selector ]) {
    const sel = getSelector(selector);
    return driver().wait(until.elementLocated(sel, 5000));
}

const operations = {
    "open (.+)": openBrowser,
    "navigate to (.+)": goToPage,
    "type (.+) into (.+)": typeKeys,
    "wait for title to be \"(.+)\"": waitForTitle,
    "\\[test (.+)\\]": startTest,
    "\\[endtest\\]": endTest,
    "click (.+)": clickElement,
    "sleep (.+)": sleep,
    "wait until located (.+)": waitForElement,
};

(async function example() {
    const handleLines = async () => {
        for (let line of lines) {
            if (line === "") {
                continue;
            }
            let handled = false;
            for (const operation in operations) {
                const reg = RegExp(`^${operation}$`)
                const matches = line.match(reg);
                if (matches) {
                    const params = [...matches];
                    params.shift();
                    const func = operations[operation];
                    try {
                        await func(params);
                    } catch (error) {
                        const test = variables["jbehave.activeTest"];
                        if (test) {
                            console.log(`Test ${test} - FAILURE`, error);
                        }
                        return;
                    }
                    handled = true;
                    break;
                }
            }
            
            if (!handled) {
                console.log(`Unable to handle "${line}"`);
            }
        }
    }

    await handleLines();
    
    if (variables["jsbehave.driver"]) {
        //await variables["jsbehave.driver"].quit();
    }
})();
