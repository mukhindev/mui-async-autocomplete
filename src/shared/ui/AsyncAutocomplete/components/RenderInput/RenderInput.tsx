import { AutocompleteRenderInputParams, TextField } from "@mui/material";

interface RenderInputProps extends AutocompleteRenderInputParams {
  name?: string;
  label?: string;
  placeholder?: string;
}

export default function RenderInput(props: RenderInputProps) {
  const { name, label, placeholder, ...renderInputParams } = props;

  return (
    <TextField
      {...renderInputParams}
      name={name}
      label={label}
      placeholder={placeholder}
    />
  );
}
