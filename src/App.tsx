import AsyncAutocomplete, {
  OptionsRequestParams,
} from "./shared/ui/AsyncAutocomplete";
import { useState } from "react";
import { Stack } from "@mui/material";

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

  const [values, setValues] = useState<TodoModel[]>([
    customValue1,
    customValue2,
  ]);

  const [optionsCache, setOptionsCache] = useState<TodoModel[]>();

  const handleOptionsRequest = async ({
    search,
    signal,
  }: OptionsRequestParams) => {
    // Забрать из кеша, если он есть и это не запрос на поиск
    if (optionsCache && !search) {
      return optionsCache;
    }

    const res = await fetch(
      `https://jsonplaceholder.typicode.com/todos/?search=${search}`,
      { signal },
    );

    const options = await res.json();

    // Сохранить в кеш если не запрос на поиск
    if (!search) {
      setOptionsCache(options);
    }

    return options;
  };

  return (
    <Stack direction="row" flexWrap="wrap" gap={3}>
      <AsyncAutocomplete
        name="single"
        label="Одиночный"
        size="small"
        sx={{ width: 240 }}
        value={value}
        getOptionLabel={(option) => option.title}
        isOptionEqualToValue={(option, value) => option.title === value.title}
        onOptionsRequest={handleOptionsRequest}
        onChange={(_, value) => setValue(value)}
      />
      <AsyncAutocomplete
        multiple
        name="multi"
        label="Мульти"
        size="small"
        sx={{ width: 480 }}
        value={values}
        getOptionLabel={(option) => option.title}
        isOptionEqualToValue={(option, value) => option.title === value.title}
        onOptionsRequest={handleOptionsRequest}
        onChange={(_, value) => setValues(value)}
      />
    </Stack>
  );
}
