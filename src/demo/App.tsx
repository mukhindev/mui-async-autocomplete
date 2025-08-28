import AsyncAutocomplete, { OptionsRequestParams } from "../lib";
import { useRef, useState } from "react";
import { Stack } from "@mui/material";
import { AsyncAutocompleteMultipleWithNot } from "../lib/wrappers";

type TodoModel = {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
};

// Для проверки работы со значением не в опциях (например вне пагинации)
const customValue1 = {
  id: 998,
  userId: 5,
  title: "Меня нет в опциях",
  completed: true,
};

const customValue2 = {
  id: 999,
  userId: 7,
  title: "И меня тоже нет",
  completed: true,
};

export default function App() {
  const [value, setValue] = useState<TodoModel | null>(customValue1);
  const [values, setValues] = useState<TodoModel[]>([customValue1, customValue2]); // prettier-ignore
  const optionsCache = useRef<TodoModel[]>();
  const lastCacheTimestamp = useRef<number>();
  const [simpleValue, setSimpleValue] = useState<string | null>("Я");

  // Запрос опций
  const handleOptionsRequest = async ({
    search,
    signal,
    reason,
  }: OptionsRequestParams) => {
    // Запросы имеют причины вызова. Например, нажали "Выделить все"
    if (reason === "select-all") {
      // Что-то делаем
    }

    // Забрать из кеша, если он есть и это не запрос на поиск
    if (
      lastCacheTimestamp.current &&
      Date.now() - lastCacheTimestamp.current < 60 * 1000 &&
      !search
    ) {
      return optionsCache.current;
    }

    const res = await fetch(
      `https://jsonplaceholder.typicode.com/todos/?search=${search}`,
      { signal },
    );

    const options = await res.json();

    // Имитация долгого запроса
    await delay(500);

    // Сохранить в кеш если не запрос на поиск
    if (!search) {
      optionsCache.current = options;
      lastCacheTimestamp.current = Date.now();
    }

    return options;
  };

  return (
    <Stack direction="row" flexWrap="wrap" gap={3}>
      <AsyncAutocomplete
        name="single"
        label="Одиночный"
        isShowSelectAll
        size="small"
        sx={{ width: 240 }}
        isOptionsPrefetch
        // onOptionsPrefetch={(options) => {
        //   setValue(options[0]);
        // }}
        value={value}
        getOptionLabel={(option) => option.title}
        isOptionEqualToValue={(option, value) => option.title === value.title}
        onOptionsRequest={handleOptionsRequest}
        onChange={(_, value) => setValue(value)}
      />
      <AsyncAutocompleteMultipleWithNot<TodoModel>
        getId={(value) => value.id}
        onNotChange={(options) => {
          setValues(options);
        }}
      >
        <AsyncAutocomplete
          multiple
          name="multi"
          label="Мульти"
          size="small"
          sx={{ width: 480 }}
          value={values}
          disableCloseOnSelect
          getOptionLabel={(option) => option.title}
          isOptionEqualToValue={(option, value) => option.title === value.title}
          getOptionKey={(option) => option.id}
          onOptionsRequest={handleOptionsRequest}
          onChange={(_, value) => setValues(value)}
        />
      </AsyncAutocompleteMultipleWithNot>
      <AsyncAutocomplete
        name="simple"
        creatable
        label="Простое значение"
        size="small"
        sx={{ width: 240 }}
        value={simpleValue}
        options={["A", "Б", "В"]}
        isOptionEqualToValue={(option, value) => option === value}
        onChange={(_, value) => setSimpleValue(value)}
      />
    </Stack>
  );
}

function delay(duration = 1000) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
