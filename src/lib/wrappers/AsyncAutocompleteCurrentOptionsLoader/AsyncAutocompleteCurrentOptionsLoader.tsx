import { ReactElement, useEffect, useRef, useState } from "react";
import { AsyncAutocompleteProps } from "../../AsyncAutocomplete";

export type CurrentOptionsRequestParams = {
  name?: string;
  ids: string[];
  signal?: AbortSignal;
};

interface AsyncAutocompleteCurrentOptionsLoaderProps<S> {
  ids: string[];
  children: ReactElement<AsyncAutocompleteProps<S, true>>;
  onCurrentOptionsRequest: (
    params: CurrentOptionsRequestParams,
  ) => Promise<S[]>;
}

/** Обёртка для `<AsyncAutocomplete />`, которая поможет получить список текущих опций по массиву идентификаторов.
 * Например, в случаях, когда известны только ids, но нет самих моделей.
 *
 * ```JavaScript
 * <AsyncAutocompleteCurrentOptionLoader
 *   ids={[42, 43, 44]}
 *   onCurrentOptionsRequest={handleCurrentOptionsRequest}
 * >
 *   <AsyncAutocomplete />
 * </AsyncAutocompleteCurrentOptionLoader>
 * ```
 * */
export default function AsyncAutocompleteCurrentOptionsLoader<S>(
  props: AsyncAutocompleteCurrentOptionsLoaderProps<S>,
) {
  const { ids, children, onCurrentOptionsRequest } = props;

  const [currentOptions, setCurrentOptions] = useState<S[]>([]);
  const currentOptionsRef = useRef(currentOptions);
  currentOptionsRef.current = currentOptions;

  const nameRef = useRef(children.props.name);
  nameRef.current = children.props.name;

  const onCurrentOptionRequestRef = useRef(onCurrentOptionsRequest);
  onCurrentOptionRequestRef.current = onCurrentOptionsRequest;

  const abortControllerRef = useRef<AbortController>();

  // Получить текущие опцию по списку ids, если ещё не было получено
  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    if (ids?.length > 0 && !currentOptionsRef.current.length) {
      onCurrentOptionRequestRef
        .current({
          ids,
          name: nameRef.current,
          signal: abortControllerRef.current.signal,
        })
        .then((currentOptions) => {
          if (currentOptions) {
            setCurrentOptions(currentOptions);
          }
        });
    } else {
      setCurrentOptions([]);
    }
  }, [ids]);

  const WrappedAsyncAutocomplete = children.type;

  const handleChange: AsyncAutocompleteProps<S, true>["onChange"] = (
    evt,
    options,
    reason,
    details,
  ) => {
    children.props.onChange?.(evt, options, reason, details);
    setCurrentOptions(options);
  };

  return (
    <WrappedAsyncAutocomplete
      {...children.props}
      value={currentOptions}
      onChange={handleChange}
    />
  );
}
