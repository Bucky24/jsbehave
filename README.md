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

## Text

Text that is wrapped in double quotes is treated as text

Text that is return sends the enter key to the element

## Selector

Selectors are of the format `type=value`

| Type | Description |
| ---- | ----------- |
| name | Searches by element name |
| text | Searches for elements containing text |
| selector | Searches for elements matching css selector |