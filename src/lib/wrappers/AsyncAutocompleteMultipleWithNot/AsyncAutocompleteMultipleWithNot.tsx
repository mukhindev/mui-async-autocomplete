import { Box, Checkbox, Chip, Stack } from "@mui/material";
import { ReactElement, useCallback, useMemo, useRef } from "react";
import { AsyncAutocompleteProps } from "../../AsyncAutocomplete";
import { AddOutlined, RemoveOutlined } from "@mui/icons-material";

export type NotModel = {
  _not?: boolean;
};

interface AsyncAutocompleteMultipleWithNotProps<S> {
  /** Получение идентификатора модели */
  getId: (option: S) => string | number;
  onNotChange: (options: (S & NotModel)[]) => void;
  children: ReactElement<AsyncAutocompleteProps<S, true>>;
}

/**
 * Обёртка для `<AsyncAutocomplete />`, реализующая поддержку оператора NOT для выбранных опций.
 * Совместима только с multiple режимом AsyncAutocomplete.
 * Нет возможности переопределить renderTags, через него рисуются минусы
 *
 * ```TypeScript
 * const [users, setUsers] = useState<(UserModel & NotModel)[]>([]);
 *
 * <AsyncAutocompleteMultipleWithNot
 *   // Получить идентификатор, по которому определять уникальность значения
 *   getId={(option) => option.id}
 *   // Изменении NOT оператора в значениях
 *   onNotChange={setUsers}
 * >
 *   <AsyncAutocomplete
 *      multiple
 *      value={users}
 *      getOptionLabel={(option) => option.email}
 *      isOptionEqualToValue={(option, value) => option.id === value.id}
 *      onOptionsRequest={async () => {
 *        const res = await userApi.getUsers({});
 *        return res.data;
 *      }}
 *      onChange={(_, options) => setUsers(options)}
 *   />
 * </AsyncAutocompleteMultipleWithNot>
 * ```
 * */
export default function AsyncAutocompleteMultipleWithNot<S>(
  props: AsyncAutocompleteMultipleWithNotProps<S & NotModel>,
) {
  const { children, getId, onNotChange } = props;

  const getIdRef = useRef(getId);
  getIdRef.current = getId;

  // values так как в режиме multiple
  const { value: values = [] } = children.props;

  // Карта NOT. Соотношение идентификатора и значения NOT (true если NOT)
  const notMap = useMemo(() => {
    const map: Record<string, boolean> = {};

    if (Array.isArray(values)) {
      values.forEach((el) => {
        map[getIdRef.current(el)] = el._not ?? false;
      });
    }

    return map;
  }, [values]);

  type OnChange = NonNullable<
    AsyncAutocompleteProps<S & NotModel, true>["onChange"]
  >;

  const handleChange = useCallback<OnChange>(
    (evt, options, reason, details) => {
      children.props.onChange?.(evt, options, reason, details);
    },
    [children.props],
  );

  const handleNotChange = useCallback(
    (option: S & NotModel, not: boolean) => {
      const clonedValues = [...(children.props.value ?? [])];
      const currentId = getIdRef.current(option);

      const clonedValuesWithNot = clonedValues.map((value) => {
        const valueId = getIdRef.current(value);

        // Изменить на противоположное NOT текущую опцию
        if (currentId === valueId) {
          return {
            ...value,
            _not: !not,
          };
        }

        return value;
      });

      onNotChange(clonedValuesWithNot);
    },
    [children.props.value, onNotChange],
  );

  type RenderTags = NonNullable<
    AsyncAutocompleteProps<S & NotModel, true>["renderTags"]
  >;

  const renderTags = useCallback<RenderTags>(
    (tagValue, getTagProps) => {
      return tagValue.map((option, index) => {
        const id = getIdRef.current(option);
        const not = notMap[getIdRef.current(option)];

        return (
          <Chip
            {...getTagProps({ index })}
            size="small"
            key={id}
            label={
              <Stack direction="row" alignItems="center">
                <Checkbox
                  aria-label={not ? "Включать опцию" : "Исключать опцию"}
                  // Считать что условно снимаем галочку когда ходим исключить (визуально не галочка)
                  checked={!not}
                  color={not ? "error" : "success"}
                  icon={<RemoveOutlined color="error" />}
                  checkedIcon={<AddOutlined color="success" />}
                  edge="start"
                  size="small"
                  onChange={() => handleNotChange(option, not)}
                />
                <Box component="span">
                  {children.props.getOptionLabel?.(option)}
                </Box>
              </Stack>
            }
          />
        );
      });
    },
    [children.props, handleNotChange, notMap],
  );

  const WrappedAsyncAutocomplete = children.type;

  return (
    <WrappedAsyncAutocomplete
      {...children.props}
      multiple
      renderTags={renderTags}
      onChange={handleChange}
    />
  );
}
