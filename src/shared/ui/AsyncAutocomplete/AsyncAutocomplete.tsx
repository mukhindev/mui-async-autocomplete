import { Autocomplete, AutocompleteProps } from "@mui/material";
import RenderInput from "./components/RenderInput";
import { useEffect, useMemo, useRef, useState } from "react";

export type OptionsRequestParams = {
  name?: string;
  search?: string;
  signal?: AbortSignal;
};

export type OptionsRequest<T> = (
  params: OptionsRequestParams,
) => (T[] | void) | Promise<T[] | void>;

interface AsyncAutocompleteProps<
  T,
  /** multiple */
  M extends boolean = false,
  /** disableClearable */
  C extends boolean = false,
  /** freeSolo */
  F extends boolean = false,
> extends Partial<AutocompleteProps<T, M, C, F>> {
  name?: string;
  label?: string;
  placeholder?: string;
  onOptionsRequest?: OptionsRequest<T>;
}

/** Надстройка над Mui Autocomplete, облегчающая работу с асинхронными данными */
export default function AsyncAutocomplete<
  T,
  M extends boolean = false,
  C extends boolean = false,
  F extends boolean = false,
>(props: AsyncAutocompleteProps<T, M, C, F>) {
  type Props = AutocompleteProps<T, M, C, F>;

  const {
    name,
    label,
    placeholder,
    options = [],
    value,
    multiple,
    isOptionEqualToValue,
    onInputChange,
    onOpen,
    onOptionsRequest,
    ...autocompleteProps
  } = props;

  const abortControllerRef = useRef<AbortController>();

  const [requestedOptions, setRequestedOptions] = useState<T[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  /** Микс из опций обычный, запрошенных и отсутствующих (текущие значения вне опций) */
  const mixedOptions = useMemo(() => {
    const propsAndRequestedOptions = [...options, ...requestedOptions];

    if (value !== null) {
      const isFound = (value: T) => {
        return !!propsAndRequestedOptions.find((option) => {
          return isOptionEqualToValue?.(option, value);
        });
      };

      if (!Array.isArray(value)) {
        if (!isFound(value as T)) {
          propsAndRequestedOptions.unshift(value as T);
        }
      }

      if (Array.isArray(value)) {
        [...value].reverse().forEach((valueItem) => {
          if (!isFound(valueItem as T)) {
            propsAndRequestedOptions.unshift(valueItem as T);
          }
        });
      }
    }

    return propsAndRequestedOptions;
  }, [value, options, requestedOptions, isOptionEqualToValue]);

  /** Асинхронное или синхронное получение дополнительных опций */
  const handleOptionsRequest = async (params: { search: string }) => {
    if (!onOptionsRequest) {
      return;
    }

    const { search } = params;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const requestedOptions = await onOptionsRequest({
        name,
        search: search ? search : undefined,
        signal: abortControllerRef.current?.signal,
      });

      if (requestedOptions) {
        setRequestedOptions(requestedOptions);
      }
    } catch {
      /* empty */
    }
  };

  /** Запрос дополнительных опций при поиске */
  useEffect(() => {
    if (debouncedSearch) {
      handleOptionsRequest({ search: debouncedSearch });
    }
  }, [debouncedSearch]);

  /** Обработка поля ввода */
  const handleInputChange: Props["onInputChange"] = (evt, value, reason) => {
    onInputChange?.(evt, value, reason);

    // Изменён символ в поле ввода
    if (reason === "input" && value) {
      setSearch(value);
    }

    // Удалён последний символ в поле ввода
    if (reason === "input" && !value) {
      setSearch("");
      handleOptionsRequest({ search: "" });
    }

    // Выход из поля
    if (reason === "reset") {
      setSearch("");
    }
  };

  const handleOpen: Props["onOpen"] = (evt) => {
    onOpen?.(evt);
    handleOptionsRequest({ search: "" });
  };

  return (
    <Autocomplete
      renderInput={(params) => (
        <RenderInput
          {...params}
          name={name}
          label={label}
          placeholder={placeholder}
        />
      )}
      options={mixedOptions}
      multiple={multiple}
      value={value}
      isOptionEqualToValue={isOptionEqualToValue}
      onInputChange={handleInputChange}
      onOpen={handleOpen}
      {...autocompleteProps}
    />
  );
}

/** ==== Utils ==== */

/**
 * Debounce. Выполнен прям тут, чтобы не мешался в импортах,
 * и не зависеть от уже используемых
 * */
function useDebounce<T>(value: T, delay = 1000) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}
