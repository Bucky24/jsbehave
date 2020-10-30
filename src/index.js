#!/usr/bin/env node

const {Builder, By, Key, until} = require('selenium-webdriver');
const fs = require("fs");
const { EOL } = require('os');

const fileName = process.argv[2];
let specificTest = null;

if (process.argv.length > 3) {
    specificTest = process.argv[3];
}

const contents = fs.readFileSync(fileName, "utf-8");
const lines = contents.split(EOL);

const now = new Date();
const nowDate = `${now.getMonth()}-${now.getDate()}-${now.getFullYear()}`;

const variables = {
    "today_date": nowDate,
};

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
    } else if (type === "id") {
        return By.id(finalVal);
    }
}

async function openBrowser([ browser ]) {
    if (variables["jsbehave.driver"]) {
        return;
    }
    const driver = await new Builder().forBrowser(browser).build();
    variables["jsbehave.driver"] = driver;
}

function goToPage([ url ]) {
    const fullUrl = getText(url);
    return driver().get(fullUrl);
}

const keyLookup = {
    "return": Key.RETURN,
};

function getText(string) {
    if (string.startsWith("\"") && string.endsWith("\"")) {
        string = string.substr(1, string.length-2);
    } else if (string.startsWith("$")) {
        const varName = string.substr(1);
        string = getVariable(varName);
    } else if (keyLookup[string]) {
        string = keyLookup[string];
    }

    return string;
}

function typeKeys([ string, selector ]) {
    const sel = getSelector(selector);

    const element = driver().findElement(sel);

    string = getText(string);

    return element.sendKeys(string);
}

function waitForTitle([ title ]) {
    return driver().wait(until.titleIs(title), 10000)
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
    seconds = parseFloat(seconds);
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

function waitForElement([ selector ]) {
    const sel = getSelector(selector);
    return driver().wait(until.elementLocated(sel), 10000);
}

function loadConfig([ fileName ]) {
    const content = fs.readFileSync(fileName, "utf-8");

    const lines = content.split(EOL);
    for (const line of lines) {
        const [name, value] = line.split("=");
        variables[name] = value;
    }
}

async function waitForText([ selector, text ]) {
    const sel = getSelector(selector);
    const elem = await driver().findElement(sel);
    text = getText(text);
    if (elem.text === text) {
        return;
    }

    const value = await elem.getAttribute("value")
    if (value === text) {
        return;
    }

    throw new Error(`Expected element to have text ${text}. Instead it had text of ${elem.text} and value of ${value}`);
}

async function elementExists([ selector, operation ]) {
    const sel = getSelector(selector);
    const elem = await driver().findElements(sel);
    if (operation == "exist") {
        if (elem.length == 0) {
            throw new Error("Expected element to exist but it did not");
        }
    } else if (operation == "not exist") {
        if (elem.length > 0) {
            throw new Error("Expected element to not exist but it did");
        }
    }
}

function closeBrowser() {
    if (variables["jsbehave.driver"]) {
        return variables["jsbehave.driver"].quit();
    }
}

async function reloadPage() {
	const url = await driver().getCurrentUrl();
	return driver().get(url);
}

const startTestRegex = "\\[test (.+)\\]";

const operations = {
    "open (.+)": openBrowser,
    "navigate to (.+)": goToPage,
    "type (.+) into (.+)": typeKeys,
    "wait for title to be \"(.+)\"": waitForTitle,
    [startTestRegex]: startTest,
    "\\[endtest\\]": endTest,
    "click (.+)": clickElement,
    "sleep (.+)": sleep,
    "wait until located (.+)": waitForElement,
    "load (.+)": loadConfig,
    "expect element (.+) to have text (.+)": waitForText,
    "expect element (.+) to (not exist|exist)": elementExists,
	"close browser": closeBrowser,
	"reload page": reloadPage,
};

async function handleLines(lines) {
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
                    } else {
                        console.error(error);
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

(async function main() {
    // first pass, consolidate all the code into test blocks

    const allTests = {}
    let startLines = [];
    let endLines = [];

    let testLines = [];
    let inTest = false;
    let testName = null;
    for (const line of lines) {
        if (line === "") {
            continue;
        }
        if (line.startsWith("[test")) {
            const reg = RegExp(`^${startTestRegex}$`)
            const matches = line.match(reg);

            if (matches) {
                if (testLines.length > 0) {
                    startLines = [...testLines];
                }
                const params = [...matches];
                inTest = true;
                testLines = [];
                testName = params[1];
            }
        }

        testLines.push(line);

        if (line.startsWith("[endtest")) {
            inTest = false;
            allTests[testName] = [...testLines]
            testName = null;
            testLines = [];
        }
    }

    if (testLines.length > 0) {
        endLines = [...testLines];
    }

    if (specificTest) {
        if (!allTests[specificTest]) {
            console.log("No test case found for '" + specificTest + "'");
            console.log(Object.keys(allTests));
            return;
        }

        await handleLines(startLines);
        console.log("Running '" + specificTest + "'");
        const content = allTests[specificTest];
        await handleLines(content);
        await handleLines(endLines);
    } else {
        await handleLines(startLines);
        for (const testName in allTests) {
            const content = allTests[testName];
            await handleLines(content);
        }
        await handleLines(endLines);
    }
})();
