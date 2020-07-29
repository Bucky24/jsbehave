const {Builder, By, Key, until} = require('selenium-webdriver');
const fs = require("fs");
const { EOL } = require('os');

console.log(process.argv);

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

async function openBrowser([ browser ]) {
    const driver = await new Builder().forBrowser(browser).build();
    variables["jsbehave.driver"] = driver;
}

function goToPage([ url ]) {
    return driver().get(url);
}

const operations = {
    "open (.+)": openBrowser,
    "navigate to (.+)": goToPage,
};

(async function example() {
    for (let line of lines) {
        let handled = false;
        for (const operation in operations) {
            const reg = RegExp(`^${operation}$`)
            const matches = line.match(reg);
            if (matches) {
                const params = [...matches];
                params.shift();
                const func = operations[operation];
                await func(params);
                handled = true;
                break;
            }
        }
        
        if (!handled) {
            console.log(`Unable to handle "${line}"`);
        }
    }
    
    if (variables["jsbehave.driver"]) {
        await variables["jsbehave.driver"].quit();
    }
})();

/*
let driver = await new Builder().forBrowser('chrome').build();
try {
    await driver.get('http://www.google.com/ncr');
    await driver.findElement(By.name('q')).sendKeys('webdriver', Key.RETURN);
    await driver.wait(until.titleIs('webdriver - Google Search'), 1000);
} finally {
    await driver.quit();
}
*/