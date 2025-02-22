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
 * <AsyncAutocompleteCurrentOptionsLoader
 *   ids={[42, 43, 44]}
 *   onCurrentOptionsRequest={handleCurrentOptionsRequest}
 * >
 *   <AsyncAutocomplete />
 * </AsyncAutocompleteCurrentOptionsLoader>
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

  // Получить текущие опцию по списку ids, если ещё не было получено
  useEffect(() => {
    const abortController = new AbortController();

    if (ids?.length > 0 && !currentOptionsRef.current.length) {
      onCurrentOptionRequestRef
        .current({
          ids,
          name: nameRef.current,
          signal: abortController.signal,
        })
        .then((currentOptions) => {
          if (currentOptions) {
            setCurrentOptions(currentOptions);
          }
        })
        .catch((reason) => {
          // Не выкидывать ошибку, если прервано сигналом
          if (abortController.signal.aborted) {
            return;
          }

          throw reason;
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
