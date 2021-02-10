#!/usr/bin/env node

const {Builder, By, Key, until} = require('selenium-webdriver');
const fs = require("fs");
const { EOL } = require('os');
const path = require("path");
const clipboardy = require('clipboardy');
const { v4: uuidv4 } = require('uuid');

const fileName = process.argv[2];
let specificTest = null;

if (process.argv.length > 3) {
    specificTest = process.argv[3];
}

const contents = fs.readFileSync(fileName, "utf-8");
const lines = contents.split(EOL);

const now = new Date();
const nowDate = `${now.getMonth()+1}-${now.getDate()}-${now.getFullYear()}`;

const variables = {
    "today_date": nowDate,
    "jsbehave.run_tests": [],
};

const allTests = {};
const beforeAll = [];
const beforeEach = [];
const afterAll = [];
const afterEach = [];
let customSelectors = {};
let customOperations = {};

function getVariable(name) {
    if (name === 'clipboard') {
        return clipboardy.readSync();
    }
    return variables[name];
}

function setVariable(key, value) {
    if (key === "clipboard") {
        clipboardy.writeSync(value);
        return;
    }
    variables[key] = value;
}

function driver() {
    const name = getVariable("jsbehave.active_driver") || "default";
    return getVariable(`jsbehave.driver.${name}`);
}

function getSelector(selector) {
    const [type, ...other] = selector.split("=");

    let finalVal = other.join("=");

    if (finalVal.startsWith("$")) {
        finalVal = getVariable(finalVal.substr(1));
    }

    if (type === "name") {
        return By.name(finalVal);
    } else if (type === "text") {
        return By.xpath(`//*[text()="${finalVal}"]`);
    } else if (type === "selector") {
        return By.css(finalVal);
    } else if (type === "id") {
        return By.id(finalVal);
    } else if (type === "data-id") {
        return By.css(`*[data-test-id="${finalVal}"]`);
    } else if (type === "xpath") {
        return By.xpath(finalVal);
    } else if (customSelectors[type]) {
        return customSelectors[type]({ By, getVariable }, finalVal);
    }
}

async function openBrowser([ browser ]) {
    const name = "default"
    const driverName = `jsbehave.driver.${name}`;
    if (variables[driverName]) {
        return;
    }
    const driver = await new Builder().forBrowser(browser).build();
    variables[driverName] = driver;
    variables["jsbehave.active_driver"] = name;
}

async function openBrowserWithName([ browser, name ]) {
    const driverName = `jsbehave.driver.${name}`;
    if (variables[driverName]) {
        return;
    }
    const driver = await new Builder().forBrowser(browser).build();
    variables[driverName] = driver;
    variables["jsbehave.active_driver"] = name;
}

function goToPage([ url ]) {
    const fullUrl = getText(url);
    return driver().get(fullUrl);
}

const keyLookup = {
    "return": Key.RETURN,
};

function getText(string, allowRegex) {
    if (string.startsWith("\"") && string.endsWith("\"")) {
        string = string.substr(1, string.length-2);
    } else if (string.startsWith("$")) {
        const varName = string.substr(1);
        string = getVariable(varName);
    } else if (keyLookup[string]) {
        string = keyLookup[string];
    } else if (string.startsWith("/") && allowRegex) {
        let regexStr = string.substr(1);
        if (string.endsWith("/"));
        regexStr = regexStr.substr(0, regexStr.length-1)
        string = new RegExp(regexStr);
    } else if (string === "uuid") {
        string = uuidv4();
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
    variables["jsbehave.activeTest"] = test;
}

function endTest() {
    const test = variables["jsbehave.activeTest"];

    console.log(`Test ${test} - SUCCESS`);
    delete variables["jsbehave.activeTest"];
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
    const activeBrowser = getVariable("jsbehave.active_driver");
    const driver = getVariable(`jsbehave.driver.${activeBrowser}`);
    if (!driver) {
        throw new Error("Unable to close default browser: no driver found");
    }
    delete variables[`jsbehave.driver.${activeBrowser}`];
    return driver.close();
}

async function reloadPage() {
	const url = await driver().getCurrentUrl();
	return driver().get(url);
}

async function noop() {
    // nothing
}

async function runTest(name, showTitle=false) {
    for (const before of beforeEach) {
        await handleLines(before);
    }
    if (showTitle) {
        console.log("Running '" + name + "'");
    }
    const content = allTests[name];
    await handleLines(content);
    for (const after of afterEach) {
        await handleLines(after);
    }

    const testsRun = getVariable("jsbehave.run_tests");
    variables["jsbehave.run_tests"] = [
        ...testsRun,
        name,
    ];
}

async function runTestIfNotRun([ testName ]) {
    const testsRun = getVariable("jsbehave.run_tests");
    if (testsRun.includes(testName)) {
        return;
    }
    const oldTest = getVariable("jsbehave.activeTest");

    await runTest(testName, true);
    variables["jsbehave.activeTest"] = oldTest;
}

async function doRunTest([ testName]) {
    return runTest(testName, true);
}

function loadFuncs([ fileName ]) {
    const cwd = process.cwd()
    const fullPath = path.resolve(cwd, fileName);
    const importFuncs = require(fullPath);

    if (importFuncs.selectors) {
        customSelectors = {
            ...customSelectors,
            ...importFuncs.selectors,
        };
    }
    if (importFuncs.operations) {
        customOperations = {
            ...customOperations,
            ...importFuncs.operations,
        };
    }
}

async function expectElementCount([ selector, count ]) {
    const countInt = parseInt(count, 10);
    const sel = getSelector(selector);
    const elems = await driver().findElements(sel);

    if (elems.length !== countInt) {
        throw new Error(`Expected to find ${countInt} elements but found ${elems.length}`);
    }
}

function matchVariable([ variable, text ]) {
    const workingVariable = variable.startsWith("$") ? variable.substr(1) : variable;
    const matchText = getText(text, true);

    const value = getVariable(workingVariable);
    let match = false;

    if (value) {
        if (matchText instanceof RegExp) {
            const result = value.match(matchText);
            match = !!result;
        } else {
            match = matchText == value;
        }
    }

    if (!match) {
        throw new Error(`Expected variable ${workingVariable} to be "${text}" but it was "${value}"`);
    }
}

function setActiveBrowser([ name ]) {
    const driverTest = getVariable(`jsbehave.driver.${name}`);

    if (!driverTest) {
        throw new Error(`Unable to set active browser to "${name}": no active driver found for name`);
    }

    variables["jsbehave.active_driver"] = name;
}

function closeBrowserWithName([ name ]) {
    const driver = getVariable(`jsbehave.driver.${name}`);
    if (!driver) {
        throw new Error(`Unable to close browser with name "${name}": no driver found`);
    }
    delete variables[`jsbehave.driver.${name}`];
    return driver.close();
}

async function compareContent([ selector, text ]) {
    const sel = getSelector(selector);
    const elem = await driver().findElement(sel);
    text = getText(text);
    const html = await elem.getAttribute('innerHTML');
    if (html === text) {
        return;
    }

    const value = await elem.getAttribute('value');
    if (value === text) {
        return;
    }

    throw new Error(`Expected element to have inner html of "${text}". Instead it had inner html of "${html}"`);
}

function doSetVariable([ key, input ]) {
    const finalInput = getText(input);
    setVariable(key, finalInput);
}

function concatVariable([ key, input ]) {
    const finalInput = getText(input);
    const oldValue = getVariable(key) || "";
    setVariable(key, `${oldValue}${finalInput}`);
}

async function executeJS(code) {
    return driver().executeScript(code);
}

async function clickElementWithOffset([ selector, x, y ]) {
    const xNum = parseInt(x, 10);
    const yNum = parseInt(y, 10);
    const sel = getSelector(selector);

    const elem = await driver().findElement(sel);
    let offset = await elem.getRect();
    let elemX = parseInt(await offset.x, 10);
    let elemY = parseInt(await offset.y, 10);
    const actions = driver().actions({ async: true });
    await actions.move({
        x: elemX + xNum,
        y: elemY + yNum,
    }).click().perform();
}

const startTestRegex = "\\[test (.+)\\]";

const operations = {
    "open (.+) as (.+)": openBrowserWithName,
    "open (.+)": openBrowser,
    "navigate to (.+)": goToPage,
    "type (.+) into (.+)": typeKeys,
    "wait for title to be \"(.+)\"": waitForTitle,
    [startTestRegex]: startTest,
    "\\[endtest\\]": endTest,
    "click (.+) with offset \\([ ]*([0-9-.]+)\\,[ ]*([0-9-.]+)[ ]*\\)": clickElementWithOffset,
    "click (.+)": clickElement,
    "sleep (.+)": sleep,
    "wait until located (.+)": waitForElement,
    "load funcs (.+)": loadFuncs,
    "load (.+)": loadConfig,
    "expect element (.+) to have text (.+)": waitForText,
    "expect element (.+) to (not exist|exist)": elementExists,
	"close browser (.+)": closeBrowserWithName,
	"close browser": closeBrowser,
    "reload page": reloadPage,
    "\\[before all\\]": noop,
    "\\[before each\\]": noop,
    "\\[endbefore\\]": noop,
    "\\[after all\\]": noop,
    "\\[after each\\]": noop,
    "\\[endafter\\]": noop,
    "require test (.+)": runTestIfNotRun,
    "expect elements (.+) to have count of (.+)": expectElementCount,
    "expect variable (.+) to match (.+)": matchVariable,
    "set active browser to (.+)": setActiveBrowser,
    "expect element (.+) to have content (.+)": compareContent,
    "set variable (.+) to (.+)": doSetVariable,
    "concat variable (.+) with (.+)": concatVariable,
    "run test (.+)": doRunTest,
};

async function handleLines(lines) {
    for (let line of lines) {
        if (line === "") {
            continue;
        }

        const baseSdk = {
            driver: driver(),
            getVariable,
            setVariable,
            runTest,
            handleLines,
            executeJS,
        };

        if (line.startsWith("#")) {
            // skip, commented line
            continue;
        }
        const allOperations = {
            ...operations,
            ...customOperations,
        };
        let handled = false;
        for (const operation in allOperations) {
            const reg = RegExp(`^${operation}$`)
            const matches = line.match(reg);
            if (matches) {
                const params = [...matches];
                params.shift();
                const func = allOperations[operation];
                try {
                    // console.log('Running', line);
                    await func(params, baseSdk);
                } catch (error) {
                    const test = variables["jsbehave.activeTest"];
                    if (test) {
                        console.log(`Test ${test} - FAILURE`);
                        console.log(`Failure when running line "${line}" for "${operation}"`);
                        console.log(error);
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

    let startLines = [];
    let endLines = [];

    let testLines = [];
    let inTest = false;
    let testName = null;
    let allOrEach = null;
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
        } else if (line.startsWith("[before")) {
            if (line === "[before all]") {
                allOrEach = 'all';
            } else if (line === "[before each]") {
                allOrEach = 'each';
            }
        } else if (line.startsWith("[after")) {
            if (line === "[after all]") {
                allOrEach = 'all';
            } else if (line === "[after each]") {
                allOrEach = 'each';
            }
        }

        testLines.push(line);

        if (line.startsWith("[endtest")) {
            inTest = false;
            allTests[testName] = [...testLines]
            testName = null;
            testLines = [];
        } else if (line === "[endbefore]") {
            if (allOrEach === "all") {
                beforeAll.push([...testLines])
                testLines = [];
            } else if (allOrEach = "every") {
                beforeEach.push([...testLines])
                testLines = [];
            }
            allOrEach = null;
        } else if (line === "[endafter]") {
            if (allOrEach === "all") {
                afterAll.push([...testLines])
                testLines = [];
            } else if (allOrEach = "every") {
                afterEach.push([...testLines])
                testLines = [];
            }
            allOrEach = null;
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
        console.log("Running beforeAll");
        for (const before of beforeAll) {
            await handleLines(before);
        }
        await runTest(specificTest, true);
        console.log("Running afterAll");
        for (const after of afterAll) {
            await handleLines(after);
        }
        await handleLines(endLines);
    } else {
        await handleLines(startLines);
        console.log("Running beforeAll");
        for (const before of beforeAll) {
            await handleLines(before);
        }
        for (const testName in allTests) {
            await runTest(testName, true);
        }
        console.log("Running afterAll");
        for (const after of afterAll) {
            await handleLines(after);
        }
        await handleLines(endLines);
    }
})();
