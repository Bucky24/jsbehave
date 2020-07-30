# jsbehave
A module that allows an easy way to write browser based testing in Selenium

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

## Text

Text that is wrapped in double quotes is treated as text

Text that is return sends the enter key to the element

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