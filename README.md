# jsbehave
A module that allows an easy way to write browser based testing in Selenium

# Usage

In order to use this, you must have the webdriver for your chosen browser accessible in your path. For example, using Chrome:
* Download chromedriver for your browser version
* Move the binary to /usr/local/bin

## Operations

`open <browser>` (note the name for this browser is `default`)

`navigate to <url>`

`type <text> into <selector>`

`wait for title to be <text>`

`[test <string>]`

`[endtest]`

`click <selector>`

`sleep <number>`

`wait until located <selector>`

`load <config file>`

`expect element <selector> to have text <text>`

`expect element <selector> to exist`

`expect element <selector> to not exist`

`close browser`

`reload page`

`require test <test name>` runs the test only if it has not already been run

`expect elements <selector> to have count of <count>`

`expect variable <variable> to match <text>`

`open <browser> as <name>`

`close browser <name>`

`set active browser to <name>`

`expect element <selector> to have contents <text>`

`set variable <variable name> to <text>`

`concat variable <variable name> with <text>`

`run test <test name>` runs the test regardless if it has been run before

## Tests

The operations `[test <name>]` and `[endtest]` indicate a test block.

## Text

Text that is wrapped in double quotes is treated as text

Text that is "return" (without quotes) sends the enter key to the element

Text that starts with a $ will load a variable of the same name

Text that starts with a `/` may be considered a regex by some commands

Text that is "uuid" (without quotes) generates a new uuid-v4

## Variables

There are some special variables:

| Name | Description |
| ---- | ----------- |
| clipboard | Reads the active value from the clipboard |

## Selector

Selectors are of the format `type=value`

| Type | Description |
| ---- | ----------- |
| name | Searches by element name |
| text | Searches for elements containing text (note this is not `Text`, it can handle variables but nothing else) |
| selector | Searches for elements matching css selector |
| id | Searches for elements with the given id |
| data-id | Searches for elements with the given data-test-id |
| xpath | Searches for elements matching the given xpath selector |

## Config File

The config file is of the following format:
```
var_name=value
var_name2=value2
```

Each value is stored as a variable with the given name.

## Before and After blocks

Code in these blocks looks like the following:

```
[before all]
open chrome
[endbefore]

[before each]
reload page
[endbefore]

[test blah]

[endtest]

[after each]
# cleanup
[endafter]

[after all]
close browser
[endafter]
```

`[before all]` blocks will run before all the tests. `[before each]` runs before each test. `[after each]` runs after each test, and `[after all]` runs after all the tests are done. This is similar to most other test systems.

## Custom code

In order to load custom code, put `load funcs <filename>` in your test file.

The function should set `module.exports` to an object that looks like the following:

```
module.exports = {
    "selectors": {
        "<selector type>": <selector function>
    },
    "operations": {
        "<operation regex>": <operation function>
    }
}
```

### Selectors

Selector functions should have the following header:

```
function selectorFunction({ By, getVariable }, inputText)
```

And should return a selector method `By.*`. They can be used as follows:

```
type Blah into selector-type=foo
```

In this case the system will expect that you've setup `selector-type` as a selector. In this case `foo` would be the value of `inputText`.

## Operations

Operation functions should have the following header:

```
function operationFunction(paramsFromRegex, sdk)
```

Any return value is ignored (unless it's a promise, in which case it is awaited). Any error thrown from within an operation shows up as a test failure.

Params are any params from capture groups in the regex, and the sdk contains the following:

| Name | Description |
|------|-------------|
| driver | The selenium webdriver instance |
| getVariable | Method to get any variable (including config variables) |
| setVariable | Method to set a variable |
| runTest | Method that can run any test group |
| executeJS | Method that can execute arbitrary JavaScript code on the page |
| handleLines | Method that runs an array of JSBehave operations |