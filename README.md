# jsbehave
A module that allows an easy way to write browser based testing in Selenium

# Usage

In order to use this, you must have the webdriver for your chosen browser accessible in your path. For example, using Chrome:
* Download chromedriver for your browser version
* Move the binary to /usr/local/bin

## Operations

`open <browser>`

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

## Tests

The operations `[test <name>]` and `[endtest]` indicate a test block.

## Text

Text that is wrapped in double quotes is treated as text

Text that is "return" (without quotes) sends the enter key to the element

Text that starts with a $ will load a variable of the same name

## Selector

Selectors are of the format `type=value`

| Type | Description |
| ---- | ----------- |
| name | Searches by element name |
| text | Searches for elements containing text |
| selector | Searches for elements matching css selector |

## Config File

The config file is of the following format:
```
var_name=value
var_name2=value2
```

Each value is stored as a variable with the given name.