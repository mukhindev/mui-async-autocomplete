import {
  Autocomplete,
  AutocompleteProps,
  AutocompleteRenderInputParams,
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  IconButtonProps,
  TextField,
} from "@mui/material";
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  inProgress?: string;
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
    inProgress,
    onInputChange,
    onOpen,
    onOptionsRequest,
    ...autocompleteProps
  } = props;

  const abortControllerRef = useRef<AbortController>();

  const [requestedOptions, setRequestedOptions] = useState<T[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);

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

  const onOptionsRequestRef = useRef(onOptionsRequest);
  onOptionsRequestRef.current = onOptionsRequest;

  /** Асинхронное или синхронное получение дополнительных опций */
  const handleOptionsRequest = useCallback(
    async (params: { search: string }) => {
      const onOptionsRequest = onOptionsRequestRef.current;

      if (!onOptionsRequest) {
        return;
      }

      const { search } = params;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        setIsRequestInProgress(true);

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
      } finally {
        setIsRequestInProgress(false);
      }
    },
    [name],
  );

  /** Запрос дополнительных опций при поиске */
  useEffect(() => {
    if (debouncedSearch) {
      handleOptionsRequest({ search: debouncedSearch });
    }
  }, [debouncedSearch, handleOptionsRequest]);

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

    if (!isRequestInProgress) {
      handleOptionsRequest({ search: "" });
    }
  };

  const renderInput = useCallback(
    (params: AutocompleteRenderInputParams) => {
      return (
        <TextField
          {...params}
          name={name}
          label={label}
          placeholder={placeholder}
        />
      );
    },
    [name, label, placeholder],
  );

  return (
    <Autocomplete
      renderInput={renderInput}
      options={mixedOptions}
      noOptionsText={
        isRequestInProgress
          ? "Загрузка..."
          : search || debouncedSearch
            ? "Не найдено"
            : "Нет опций"
      }
      multiple={multiple}
      slotProps={{
        popupIndicator:
          inProgress || isRequestInProgress
            ? { component: IconButtonWithProgress }
            : undefined,
      }}
      value={value}
      isOptionEqualToValue={isOptionEqualToValue}
      onInputChange={handleInputChange}
      renderOption={(params, option, { selected }) => {
        const { id, ...liProps } = params;

        return (
          <li {...liProps} key={id}>
            {multiple && (
              <Box
                key={id}
                sx={{
                  height: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Checkbox
                  name="checkbox"
                  edge="start"
                  size="small"
                  checked={selected}
                />
              </Box>
            )}
            {props.getOptionLabel?.(option)}
          </li>
        );
      }}
      onOpen={handleOpen}
      {...autocompleteProps}
    />
  );
}

const IconButtonWithProgress = forwardRef(function IconButtonWithProgress(
  props: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const { children, ...iconButtonProps } = props;

  return (
    <IconButton {...iconButtonProps} ref={ref} sx={{ position: "relative" }}>
      {children}
      <Box
        sx={{
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={20} />
      </Box>
    </IconButton>
  );
});

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
