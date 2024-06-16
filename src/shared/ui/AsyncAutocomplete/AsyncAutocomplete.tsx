import {
  Autocomplete,
  AutocompleteFreeSoloValueMapping,
  AutocompleteProps,
  AutocompleteRenderInputParams,
  AutocompleteRenderOptionState,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  IconButtonProps,
  TextField,
} from "@mui/material";
import {
  ForwardedRef,
  forwardRef,
  LiHTMLAttributes,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const OPTION_CREATE_SYMBOL = Symbol();

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
  "data-component"?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  inProgress?: boolean;
  /** Предлагать создание новой опции если onOptionsRequest не вернул результат при поиске */
  creatable?: boolean;
  /** Событие запроса опций при открытии меню и поиске */
  onOptionsRequest?: OptionsRequest<T>;
  /** Событие создания новой опции **/
  onOptionCreate?: OptionsRequest<T>;
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
    "data-component": dataComponent,
    name,
    label,
    placeholder,
    options = [],
    value,
    multiple,
    creatable,
    getOptionLabel,
    isOptionEqualToValue,
    filterOptions,
    inProgress = false,
    onInputChange,
    onOpen,
    onOptionsRequest,
    onOptionCreate,
    ...autocompleteProps
  } = props;

  const abortControllerRef = useRef<AbortController>();

  const [requestedOptions, setRequestedOptions] = useState<T[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);

  /** Микс из опций обычный, запрошенных и отсутствующих (текущие значения вне опций) */
  const mixedOptions = useMemo<T[]>(() => {
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

  /** Извлечение лейбла для опции */
  const handleOptionLabel = useCallback(
    (option: T | AutocompleteFreeSoloValueMapping<F>) => {
      // Системные опции интегрируются через symbol
      if (typeof option === "symbol") {
        return "";
      }

      // Извлечение лейбла методом getOptionLabel
      if (getOptionLabel) {
        return getOptionLabel(option);
      }

      // Если getOptionLabel не передан и опция это строка, выводить как есть
      else if (typeof option === "string") {
        return option;
      }

      // Если getOptionLabel не передан и опция это число, привести к строке
      else if (typeof option === "number") {
        return option.toString();
      }

      return "";
    },
    [getOptionLabel],
  );

  /** Проверка полного совпадения с поиском (нужно для режима создания новый опций) */
  const isProposalToCreate = useMemo<boolean>(() => {
    // Не актуально без флага creatable
    if (!creatable || !debouncedSearch || !search) {
      return false;
    }

    const allLabels = mixedOptions.map((option) => handleOptionLabel(option));

    return !allLabels.includes(debouncedSearch);
  }, [creatable, mixedOptions, search, debouncedSearch, handleOptionLabel]);

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

  const handleOptionCreate = useCallback(() => {
    onOptionCreate?.({
      name,
      search,
    });
  }, [name, onOptionCreate, search]);

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

  const renderOption = (
    params: LiHTMLAttributes<HTMLLIElement>,
    option: T,
    { selected }: AutocompleteRenderOptionState,
  ) => {
    const { id, ...liProps } = params;

    // Отрисовка служебного элемента списка о создании новой опции
    if (option === OPTION_CREATE_SYMBOL) {
      return (
        <Box
          key={id}
          component="li"
          className={liProps.className}
          sx={{ cursor: "default !important" }}
        >
          <Button
            variant="outlined"
            onClick={handleOptionCreate}
            disabled={inProgress || isRequestInProgress}
            sx={{
              textTransform: "inherit",
              pl: 1,
              pr: 1,
              pt: 0.25,
              pb: 0.25,
              width: "100%",
              textAlign: "left",
              justifyContent: "start",
            }}
          >
            Создать: {search}
          </Button>
        </Box>
      );
    }

    return (
      <Box component="li" {...liProps} key={id}>
        {multiple && (
          <Box
            key={id}
            sx={{
              height: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            {/*
              Хак для улучшения производительности.
              У MUI Checkbox плохая производительность.
              TODO заменить на имитацию MUI Checkbox по дизайну
             */}
            {selected ? <MemoizedCheckedCheckbox /> : <MemoizedCheckbox />}
          </Box>
        )}
        {handleOptionLabel(option)}
      </Box>
    );
  };

  const handleOptionsFilter: Props["filterOptions"] = (options, state) => {
    const { inputValue } = state;
    const renderedOptions: T[] = [];

    if (isProposalToCreate) {
      // Естественно OPTION_CREATE_SYMBOL не является T, хак для внутренней реализации инъекции в список опций
      renderedOptions.push(OPTION_CREATE_SYMBOL as T);
    }

    return renderedOptions.concat(
      filterOptions
        ? // Кастомный фильтр переданные сверху
          filterOptions(options, state)
        : // Фильтр по-умолчанию
          options.filter((option) =>
            handleOptionLabel(option)
              .toLocaleLowerCase()
              .includes(inputValue.toLocaleLowerCase()),
          ),
    );
  };

  return (
    <Autocomplete
      data-compoenent={
        dataComponent
          ? `AsyncAutocomplete/${dataComponent}`
          : "AsyncAutocomplete"
      }
      multiple={multiple}
      value={value}
      options={mixedOptions}
      noOptionsText={
        isRequestInProgress
          ? "Загрузка..."
          : search || debouncedSearch
            ? "Не найдено"
            : "Нет опций"
      }
      slotProps={{
        popupIndicator:
          inProgress || isRequestInProgress
            ? { component: IconButtonWithProgress }
            : undefined,
      }}
      getOptionLabel={handleOptionLabel}
      filterOptions={handleOptionsFilter}
      isOptionEqualToValue={isOptionEqualToValue}
      renderInput={renderInput}
      renderOption={renderOption}
      onInputChange={handleInputChange}
      onOpen={handleOpen}
      {...autocompleteProps}
    />
  );
}

const MemoizedCheckbox = memo(function MemoizedCheckbox() {
  return <Checkbox name="checkbox" edge="start" size="small" />;
});

const MemoizedCheckedCheckbox = memo(function MemoizedCheckedCheckbox() {
  return <Checkbox name="checkbox" edge="start" size="small" checked />;
});

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
