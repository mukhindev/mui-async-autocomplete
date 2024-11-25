# @mukhindev/mui-async-autocomplete

Extended MUI Autocomplete

## Inner props

Variant for integration to others controllers (no label and border).

Add style overrides for MuiTextField to MUI theme.

```JavaScript
const components = {
  MuiTextField: {
    styleOverrides: {
      root: {
        // Inner styles
        "&.variant_inner": {
          // Прячем label
          ".MuiInputLabel-root": {
            visibility: "hidden",
          },
          // Hide border
          fieldset: {
            border: "none",
          },
        },
      },
    },
  },
}
```
