import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import type {
  AutocompleteFreeSoloValueMapping,
  AutocompleteProps,
  AutocompleteRenderInputParams,
  AutocompleteRenderOptionState,
  IconButtonProps,
  TextFieldProps,
} from "@mui/material";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  Paper,
  TextField,
  Tooltip,
} from "@mui/material";
import type {
  ForwardedRef,
  HTMLAttributes,
  LiHTMLAttributes,
  ReactNode,
} from "react";
import {
  Fragment,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const OPTION_CREATE_SYMBOL = Symbol();

export type OptionsRequestReason =
  | "open"
  | "prefetch"
  | "search"
  | "select-all"
  | "create";

export type OptionsRequestParams = {
  name?: string;
  search?: string;
  reason: OptionsRequestReason;
  signal?: AbortSignal;
  reset: () => void;
};

export type OptionsRequest<T> = (
  params: OptionsRequestParams,
) => (T[] | void) | Promise<T[] | void>;

export interface AsyncAutocompleteProps<
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
  required?: boolean;
  /**
   * Вариант для встраивания без лейбла и обводки (например в ячейку таблицы).
   * Ваша MUI тема должна иметь переопределение (styleOverrides) "&.variant_inner" для MuiTextField
   *
   * Например такое:
   *
   * ```JavaScript
   * {
   *   MuiTextField: {
   *     styleOverrides: {
   *       root: {
   *         // Переопределение для inner варианта
   *         "&.variant_inner": {
   *           // Прячем label
   *           ".MuiInputLabel-root": {
   *             visibility: "hidden",
   *           },
   *           // Убираем обводку
   *           fieldset: {
   *             border: "none",
   *           },
   *         },
   *       },
   *     },
   *   },
   * }
   * ```
   * */
  inner?: boolean;
  /** Слот для дополнительных действий (слева от кнопки выпадающего списка) */
  actions?: ReactNode;
  inProgress?: boolean;
  /** Предлагать создание новой опции если onOptionsRequest не вернул результат при поиске */
  creatable?: boolean;
  /** Показывать кнопку "Выделить все" TODO: Лучше сделать возможность отобразить что-угодно в шапке списке */
  isShowSelectAll?: boolean;
  /** Запретить запросы при поиске */
  disableSearchOptionsRequest?: boolean;
  /** Запретить сбрасывать поиск в multiple режиме */
  disableSearchResetInMultiple?: boolean;
  /** Предварительное получение опций как только компонент монтирован, не ждать первого открытия */
  isOptionsPrefetch?: boolean;
  /** Событие при предварительном получении опций (сразу после работы onOptionsRequest) */
  onOptionsPrefetch?: (options: T[]) => void;
  /**
   * Событие запроса опций при открытии меню, поиске,
   * а также при монтировании, если `isOptionsPrefetch: true`
   * */
  onOptionsRequest?: OptionsRequest<T>;
  /** Событие создания новой опции **/
  onOptionCreate?: OptionsRequest<T>;
  renderBeforeOptionLabel?: (option: T) => ReactNode;
  renderAfterOptionLabel?: (option: T) => ReactNode;
  error?: TextFieldProps["error"];
  helperText?: TextFieldProps["helperText"];
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
    "aria-label": ariaLabel,
    name,
    label,
    placeholder,
    required = false,
    inner = false,
    actions,
    options = [],
    value,
    multiple,
    creatable,
    isShowSelectAll = false,
    disableSearchOptionsRequest = false,
    disableSearchResetInMultiple = false,
    getOptionLabel,
    isOptionEqualToValue,
    filterOptions,
    inProgress = false,
    readOnly,
    onInputChange,
    onOpen,
    isOptionsPrefetch = false,
    onOptionsPrefetch,
    onOptionsRequest,
    onOptionCreate,
    renderBeforeOptionLabel,
    renderAfterOptionLabel,
    error,
    helperText,
    sx,
    ...autocompleteProps
  } = props;

  const abortControllerRef = useRef<AbortController>();

  const [requestedOptions, setRequestedOptions] = useState<T[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);

  const isPrefetchCompletedRef = useRef(false);
  const onOptionsPrefetchRef = useRef(onOptionsPrefetch);
  onOptionsPrefetchRef.current = onOptionsPrefetch;

  /** Микс из опций обычный, запрошенных и отсутствующих (текущие значения вне опций) */
  const mixedOptions = useMemo<T[]>(() => {
    const propsAndRequestedOptions = [...options, ...requestedOptions];

    if (value !== null) {
      const isFound = (value: T) => {
        // !== undefined, так как может быть валидный 0
        return (
          propsAndRequestedOptions.find((option) => {
            return isOptionEqualToValue?.(option, value);
          }) !== undefined
        );
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

  /** Проверка, нет ли в лейблах опций полного совпадения с поиском (нужно для режима создания новой опций) */
  const isProposalToCreate = useMemo<boolean>(() => {
    // Не актуально без флага creatable
    if (!creatable || !debouncedSearch || !search) {
      return false;
    }

    const allLabels = mixedOptions.map((option) =>
      handleOptionLabel(option)?.toLowerCase(),
    );

    return !allLabels.includes(debouncedSearch.toLowerCase());
  }, [creatable, mixedOptions, search, debouncedSearch, handleOptionLabel]);

  const onOptionsRequestRef = useRef(onOptionsRequest);
  onOptionsRequestRef.current = onOptionsRequest;

  const handleRequestedOptionsReset = useCallback(() => {
    setRequestedOptions([]);
  }, []);

  /** Асинхронное или синхронное получение дополнительных опций */
  const handleOptionsRequest = useCallback(
    async (params: { search: string; reason: OptionsRequestReason }) => {
      const onOptionsRequest = onOptionsRequestRef.current;

      if (!onOptionsRequest) {
        return;
      }

      const { search, reason } = params;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        setIsRequestInProgress(true);

        const requestedOptions = await onOptionsRequest({
          name,
          search: search ? search : undefined,
          reason,
          signal: abortControllerRef.current?.signal,
          reset: handleRequestedOptionsReset,
        });

        if (requestedOptions) {
          setRequestedOptions(requestedOptions);
          return requestedOptions;
        }
      } catch {
        /* empty */
      } finally {
        setIsRequestInProgress(false);
      }
    },
    [handleRequestedOptionsReset, name],
  );

  /** Запрос дополнительных опций при поиске */
  useEffect(() => {
    if (!disableSearchOptionsRequest && debouncedSearch) {
      handleOptionsRequest({ search: debouncedSearch, reason: "search" });
    }
  }, [debouncedSearch, disableSearchOptionsRequest, handleOptionsRequest]);

  /** Предварительное получение опций и вызов связанного события */
  useEffect(() => {
    if (isOptionsPrefetch && !isPrefetchCompletedRef.current) {
      handleOptionsRequest({ search: "", reason: "prefetch" }).then(
        (options) => {
          if (options) {
            onOptionsPrefetchRef.current?.(options);
          }
        },
      );

      isPrefetchCompletedRef.current = true;
    }
  }, [handleOptionsRequest, isOptionsPrefetch]);

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
      handleOptionsRequest({ search: "", reason: "search" });
    }

    // Сброс ввода
    if (
      reason === "reset" &&
      // В multiple режиме не сбрасывать поиск, если disableSearchResetInMultiple == true
      (!multiple || (multiple && !disableSearchResetInMultiple))
    ) {
      setSearch("");
    }

    // Выход из поля
    if (reason === "blur") {
      setSearch("");
    }
  };

  /** Открытие управляется без prop open */
  const handleOpen: Props["onOpen"] = (evt) => {
    onOpen?.(evt);

    if (autocompleteProps.open === undefined && !isRequestInProgress) {
      handleOptionsRequest({ search: "", reason: "open" });
    }
  };

  /** Открытие управляется через prop open */
  useEffect(() => {
    if (autocompleteProps.open) {
      handleOptionsRequest({ search: "", reason: "open" });
    }
  }, [autocompleteProps.open, handleOptionsRequest]);

  /** Получение всех опций */
  const handleSelectAll = useCallback(() => {
    handleOptionsRequest({
      search: debouncedSearch,
      reason: "select-all",
    });
  }, [debouncedSearch, handleOptionsRequest]);

  const handleOptionCreate = useCallback(async () => {
    try {
      setIsRequestInProgress(true);

      await onOptionCreate?.({
        name,
        search,
        reason: "create",
        reset: handleRequestedOptionsReset,
      });
    } finally {
      setIsRequestInProgress(false);
    }
  }, [handleRequestedOptionsReset, name, onOptionCreate, search]);

  const renderInput = useCallback(
    (params: AutocompleteRenderInputParams) => {
      return (
        <TextField
          {...params}
          className={inner ? "variant_inner" : undefined}
          name={name}
          label={label}
          aria-label={ariaLabel}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: readOnly ? (
                <>
                  <Tooltip title="Только для чтения">
                    <LockOutlinedIcon
                      sx={{
                        fontSize: 20,
                        color: ({ palette }) => palette.text.secondary,
                        mr: "-4px",
                      }}
                    />
                  </Tooltip>
                </>
              ) : (
                <>
                  {actions}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      );
    },
    [
      inner,
      name,
      label,
      ariaLabel,
      placeholder,
      required,
      error,
      helperText,
      readOnly,
      actions,
    ],
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
      <Box component="li" {...liProps} key={id} id={id}>
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
        {renderBeforeOptionLabel && (
          <Fragment key={`${id}-BeforeOptionLabel`}>
            {renderBeforeOptionLabel(option)}
          </Fragment>
        )}
        {handleOptionLabel(option)}
        {renderAfterOptionLabel && (
          <Fragment key={`${id}-AfterOptionLabel`}>
            {renderAfterOptionLabel(option)}
          </Fragment>
        )}
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
              ?.toLocaleLowerCase()
              .includes(inputValue.toLocaleLowerCase()),
          ),
    );
  };

  return (
    <Autocomplete
      data-component={
        dataComponent
          ? `AsyncAutocomplete/${dataComponent}`
          : "AsyncAutocomplete"
      }
      multiple={multiple}
      // Управляем полем ввода только в multiple режиме
      inputValue={multiple ? search : undefined}
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
      slots={{
        paper: isShowSelectAll
          ? (props) => (
              <PaperWithSelectAllButton
                inProgress={inProgress || isRequestInProgress}
                onSelectAll={handleSelectAll}
                {...props}
              />
            )
          : undefined,
      }}
      sx={{
        // Слишком маленькое минимальная ширина поля ввода по-умолчанию у Autocomplete
        "& .MuiAutocomplete-inputRoot .MuiAutocomplete-input": {
          minWidth: 60,
        },
        "& .MuiInputBase-root": {
          paddingRight: readOnly ? "14px !important" : undefined,
        },
        ...sx,
      }}
      getOptionLabel={handleOptionLabel}
      filterOptions={handleOptionsFilter}
      isOptionEqualToValue={isOptionEqualToValue}
      renderInput={renderInput}
      renderOption={renderOption}
      onInputChange={handleInputChange}
      onOpen={readOnly ? undefined : handleOpen}
      readOnly={readOnly}
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

/** Подложка под список, с кнопкой "Выделить все" */
function PaperWithSelectAllButton(
  props: HTMLAttributes<HTMLElement> & {
    inProgress: boolean;
    onSelectAll: () => void;
  },
) {
  const { children, inProgress, onSelectAll, ...paperProps } = props;

  return (
    <Paper {...paperProps}>
      <Button
        variant="text"
        color="primary"
        disabled={inProgress}
        startIcon={<DoneAllOutlinedIcon />}
        sx={{ m: 1, mb: 0, flex: 1 }}
        onMouseDown={(evt) => {
          evt.preventDefault();
        }}
        onClick={onSelectAll}
      >
        Выделить все
      </Button>
      {children}
    </Paper>
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
