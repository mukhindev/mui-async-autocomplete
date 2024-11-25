import { ReactElement, useEffect, useRef, useState } from "react";
import { AsyncAutocompleteProps } from "../../AsyncAutocomplete";

export type CurrentOptionRequestParams = {
  name?: string;
  id: string;
  signal?: AbortSignal;
};

interface AsyncAutocompleteCurrentOptionLoaderProps<S> {
  id: string | null;
  children: ReactElement<AsyncAutocompleteProps<S>>;
  onCurrentOptionRequest: (params: CurrentOptionRequestParams) => Promise<S>;
}

/** Обёртка для `<AsyncAutocomplete />`, которая поможет получить текущую опцию по идентификатору.
 * Например, в случаях, когда известно только id, но нет самой модели.
 *
 * ```JavaScript
 * <AsyncAutocompleteCurrentOptionLoader
 *   id={(filter[filterKey] as string) ?? null}
 *   onCurrentOptionRequest={onCurrentOptionRequest}
 * >
 *   <AsyncAutocomplete />
 * </AsyncAutocompleteCurrentOptionLoader>
 * ```
 * */
export default function AsyncAutocompleteCurrentOptionLoader<S>(
  props: AsyncAutocompleteCurrentOptionLoaderProps<S>,
) {
  const { id, children, onCurrentOptionRequest } = props;

  const [currentOption, setCurrentOption] = useState<null | S>(null);
  const currentOptionRef = useRef(currentOption);
  currentOptionRef.current = currentOption;

  const nameRef = useRef(children.props.name);
  nameRef.current = children.props.name;

  const onCurrentOptionRequestRef = useRef(onCurrentOptionRequest);
  onCurrentOptionRequestRef.current = onCurrentOptionRequest;

  const abortControllerRef = useRef<AbortController>();

  // Получить текущую опцию по id, если ещё не было получено
  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    if (id && !currentOptionRef.current) {
      onCurrentOptionRequestRef
        .current({
          id,
          name: nameRef.current,
          signal: abortControllerRef.current.signal,
        })
        .then((currentOption) => {
          if (currentOption) {
            setCurrentOption(currentOption);
          }
        });
    }

    if (!id) {
      setCurrentOption(null);
    }
  }, [id]);

  const WrappedAsyncAutocomplete = children.type;

  const handleChange: AsyncAutocompleteProps<S>["onChange"] = (
    evt,
    option,
    reason,
    details,
  ) => {
    children.props.onChange?.(evt, option, reason, details);
    setCurrentOption(option);
  };

  return (
    <WrappedAsyncAutocomplete
      {...children.props}
      value={currentOption}
      onChange={handleChange}
    />
  );
}
