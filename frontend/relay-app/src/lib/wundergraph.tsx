import type { ReactNode } from "react";
import type {
  Client,
  ClientResponse,
  ResponseError,
  SubscriptionRequestOptions,
} from "@wundergraph/sdk/client";
import {
  PreloadedQuery,
  usePreloadedQuery,
  useRelayEnvironment,
} from "react-relay/hooks";
import { RelayEnvironmentProvider } from "react-relay";
import { useEffect, useState, useRef, ComponentType, FC } from "react";
import { withRelay, hydrateRelayEnvironment } from "relay-nextjs";
import {
  Environment,
  FetchFunction,
  GraphQLTaggedNode,
  Network,
  Observable,
  OperationType,
  RecordSource,
  Store,
  SubscribeFunction,
  createOperationDescriptor,
  getRequest,
} from "relay-runtime";
import { WiredOptions, WiredProps } from "relay-nextjs/wired/component";

// To avoid the error: The inferred type of X cannot be named without a reference to Y due to dependencies between relay-nextjs & next packages
// Reference: https://github.com/microsoft/TypeScript/issues/47663#issuecomment-1270716220
import type {} from "next";

export interface SubscribeToOptions extends SubscriptionRequestOptions {
  onResult(response: ClientResponse): void;
  onSuccess?(response: ClientResponse): void;
  onError?(error: ResponseError): void;
  onAbort?(): void;
}

export interface UseSubscribeToProps extends SubscriptionRequestOptions {
  enabled?: boolean;
  onSuccess?(response: ClientResponse): void;
  onError?(error: ResponseError): void;
}

export const createWunderGraphRelayApp = (client: Client) => {
  const fetchQuery: FetchFunction = async (params, variables) => {
    const { id, operationKind } = params;
    const response =
      operationKind === "query"
        ? await client.query({
            operationName: `relay/${id}`,
            input: variables,
          })
        : await client.mutate({
            operationName: `relay/${id}`,
            input: variables,
          });
    return {
      ...response,
      errors: response.error ? [response.error] : [],
    };
  };

  const subscribe: SubscribeFunction = (params, variables) => {
    return Observable.create((sink) => {
      const { id } = params;
      const abort = new AbortController();
      client
        .subscribe(
          {
            operationName: `relay/${id}`,
            input: variables,
            abortSignal: abort.signal,
          },
          (response) => {
            const graphQLResponse = {
              ...response,
              errors: response.error ? [response.error] : [],
            };
            sink.next(graphQLResponse);
          }
        )
        .catch((e) => {
          sink.error(e);
        });
      return () => {
        sink.complete();
        abort.abort();
      };
    });
  };

  const createServerNetwork = () => {
    return Network.create(fetchQuery, subscribe);
  };

  const createServerEnvironment = () => {
    return new Environment({
      network: createServerNetwork(),
      store: new Store(new RecordSource()),
      isServer: true,
    });
  };

  const createClientNetwork = () => {
    return Network.create(fetchQuery, subscribe);
  };

  let clientEnv: Environment | undefined;
  const createClientEnvironment = () => {
    if (typeof window === "undefined") return null;

    if (clientEnv == null) {
      clientEnv = new Environment({
        network: createClientNetwork(),
        store: new Store(new RecordSource()),
        isServer: false,
      });

      hydrateRelayEnvironment(clientEnv);
    }

    return clientEnv;
  };

  const subscribeTo = (options: SubscribeToOptions) => {
    const abort = new AbortController();
    const { onSuccess, onError, onResult, onAbort, ...subscription } = options;
    subscription.abortSignal = abort.signal;
    client.subscribe(subscription, onResult).catch(onError);
    return () => {
      onAbort?.();
      abort.abort();
    };
  };

  const useSubscribeTo = (
    props: UseSubscribeToProps
  ): {
    isLoading: boolean;
    isSubscribed: boolean;
    data?: ClientResponse["data"];
    error?: ClientResponse["error"];
  } => {
    const {
      operationName,
      input,
      enabled = true,
      liveQuery = true,
      subscribeOnce,
      onSuccess,
      onError,
    } = props;
    const startedAtRef = useRef<number | null>(null);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    const [state, setState] = useState({
      isLoading: false,
      isSubscribed: false,
    });

    const [data, setData] = useState<ClientResponse["data"]>();
    const [error, setError] = useState<ClientResponse["error"]>();

    useEffect(() => {
      if (enabled) {
        setState({ isLoading: true, isSubscribed: false });
      }
    }, [enabled]);

    useEffect(() => {
      let unsubscribe: ReturnType<typeof subscribeTo>;

      if (enabled) {
        unsubscribe = subscribeTo({
          operationName,
          input,
          liveQuery,
          subscribeOnce,
          onError(error) {
            setState({ isLoading: false, isSubscribed: false });
            onErrorRef.current?.(error);
            startedAtRef.current = null;
          },
          onResult(result) {
            if (!startedAtRef.current) {
              setState({ isLoading: false, isSubscribed: true });
              onSuccessRef.current?.(result);
              startedAtRef.current = new Date().getTime();
            }

            setData(result.data);
            setError(result.error);
          },
          onAbort() {
            setState({ isLoading: false, isSubscribed: false });
            startedAtRef.current = null;
          },
        });
      }

      return () => {
        unsubscribe?.();
      };
    }, [enabled, liveQuery, subscribeOnce]);

    return {
      data,
      error,
      ...state,
    };
  };

  const withWunderGraphRelay = <Props extends WiredProps, ServerSideProps>(
    Component: ComponentType<Props>,
    query: GraphQLTaggedNode,
    opts: Omit<
      WiredOptions<Props, ServerSideProps>,
      "createClientEnvironment" | "createServerEnvironment"
    >
  ) => {
    const WrappedComponent: ReturnType<
      typeof withRelay<Props, ServerSideProps>
    > & { displayName?: string } = withRelay(Component, query, {
      createClientEnvironment: () => createClientEnvironment()!,
      createServerEnvironment: async () => {
        return createServerEnvironment();
      },
      ...opts,
    });

    // Adding a display Name to help with debugging with React Dev Tools
    WrappedComponent.displayName = `withWunderGraphRelay(${
      Component.displayName || Component.name
    })`;

    return WrappedComponent;
  };

  const useLivePreloadedQuery = <TQuery extends OperationType>(
    gqlQuery: Parameters<typeof usePreloadedQuery>[0],
    preloadedQuery: PreloadedQuery<TQuery>,
    options?: Parameters<typeof usePreloadedQuery>[2],
    subscriptionOptions: Omit<
      UseSubscribeToProps,
      "operationName" | "input"
    > = {}
  ): {
    error?: ClientResponse["error"];
    isSubscribed?: boolean;
    isLoading?: boolean;
    data: TQuery["response"];
  } => {
    const data = usePreloadedQuery(gqlQuery, preloadedQuery, options);
    const environment = useRelayEnvironment();

    const { id, variables } = preloadedQuery;

    const {
      data: liveData,
      error,
      isSubscribed,
      isLoading,
    } = useSubscribeTo({
      operationName: `relay/${id}`,
      input: variables,
      ...subscriptionOptions,
    });

    useEffect(() => {
      if (liveData) {
        const request = getRequest(gqlQuery);
        const operationDescriptor = createOperationDescriptor(
          request,
          variables
        );
        environment.commitPayload(operationDescriptor, liveData);
      }
    }, [liveData]);

    return {
      data,
      error,
      isSubscribed,
      isLoading,
    };
  };

  const clientEnvironment = new Environment({
    network: createClientNetwork(),
    store: new Store(new RecordSource()),
    isServer: false,
  });

  const WunderGraphRelayProvider: FC<{ children?: ReactNode }> = ({
    children,
  }) => {
    return (
      <RelayEnvironmentProvider environment={clientEnvironment}>
        {children}
      </RelayEnvironmentProvider>
    );
  };

  return {
    createClientEnvironment,
    createClientNetwork,
    createServerEnvironment,
    createServerNetwork,
    useLivePreloadedQuery,
    withWunderGraphRelay,
    WunderGraphRelayProvider,
  };
};
