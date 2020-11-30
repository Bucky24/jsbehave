#!/usr/bin/env node

const {Builder, By, Key, until} = require('selenium-webdriver');
const fs = require("fs");
const { EOL } = require('os');
const path = require("path");

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
    } else if (type === "data-id") {
        return By.css(`*[data-test-id="${finalVal}"]`);
    } else if (type === "xpath") {
        return By.xpath(finalVal);
    } else if (customSelectors[type]) {
        return customSelectors[type]({ By }, finalVal);
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
    if (variables["jsbehave.driver"]) {
        return variables["jsbehave.driver"].quit();
    }
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
    "load funcs (.+)": loadFuncs,
    "load (.+)": loadConfig,
    "expect element (.+) to have text (.+)": waitForText,
    "expect element (.+) to (not exist|exist)": elementExists,
	"close browser": closeBrowser,
    "reload page": reloadPage,
    "\\[before all\\]": noop,
    "\\[before each\\]": noop,
    "\\[endbefore\\]": noop,
    "\\[after all\\]": noop,
    "\\[after each\\]": noop,
    "\\[endafter\\]": noop,
    "require test (.+)": runTestIfNotRun,
};

async function handleLines(lines) {
    for (let line of lines) {
        if (line === "") {
            continue;
        }

        if (line.startsWith("#")) {
            // skip, commented line
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
                    const test = variables["jsbehave.activeTest"];
                    if (test) {
                        console.log(`Test ${test} - FAILURE`);
                        console.log(`Failure when running line "${line}"`);
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
