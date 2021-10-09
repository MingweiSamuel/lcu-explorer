import React, { useState, useEffect } from "react";
import { ipcRenderer } from "electron";
import Swagger from "swagger-ui";
import axios, { AxiosResponse } from "axios";

import Titlebar from "@components/Titlebar";
import SwaggerUI from "swagger-ui";

type SwaggerUIUpdatable = SwaggerUI & { updateSpec: (specUpdates: object) => void };

const BASIC_AUTH = "BasicAuth";

const Home = (): JSX.Element => {
  const [credentials, SetCredentials] = useState<{
    address: string;
    port: number;
    username: string;
    password: string;
    protocol: string;
  }>();

  function loadCredentials(swagger: SwaggerUIUpdatable) {
    if (credentials == null) {
      return;
    }
    console.log('UPDATING CREDENTIALS', credentials);
    swagger.updateSpec({
      servers: [
        {
          url: `https://127.0.0.1:${credentials.port}`,
          description: "default",
        }
      ],
    });
    swagger.preauthorizeBasic(
      BASIC_AUTH,
      credentials.username,
      credentials.password
    );
  }

  const swaggerPromise = new Promise<SwaggerUIUpdatable>((resolve, reject) => {
    useEffect(() => {
      try {
        const swagger = Swagger({
          dom_id: "#swagger",
          spec: {
            openapi: "3.0.0",
            security: [
              {
                [BASIC_AUTH]: [],
              },
            ],
            components: {
              securitySchemes: {
                [BASIC_AUTH]: {
                  type: "http",
                  scheme: "basic",
                },
              },
            },
          },
          operationsSorter: "alpha",
          tagsSorter: "alpha",
          docExpansion: "none",
          defaultModelExpandDepth: 1,
          displayRequestDuration: true,
          filter: "",
          deepLinking: false, // @ts-ignore
          "request.curlOptions": ["--insecure"], // TODO: doesn't seem to show up.
          plugins: [
            (system) => ({
              rootInjects: {
                updateSpec: (specUpdates: object) => {
                  const jsonSpec = system.getState().toJSON().spec.json;
                  const newJsonSpec = Object.assign({}, jsonSpec, specUpdates);
                  // Preserve securitySchemes.
                  newJsonSpec.components.securitySchemes = jsonSpec.components.securitySchemes;
                  return system.specActions.updateJsonSpec(newJsonSpec);
                },
              },
            })
          ]
        }) as SwaggerUIUpdatable;
        loadCredentials(swagger);
        resolve(swagger);
      }
      catch(e) {
        reject(e);
      }
    }, []);
  });

  useEffect(() => {
    swaggerPromise.then(loadCredentials);
  }, [credentials]);

  useEffect(() => {
    axios.get("https://www.mingweisamuel.com/lcu-schema/lcu/openapi.json")
      .then((res: AxiosResponse<any>) => swaggerPromise
        .then(swagger => swagger.updateSpec(res.data)))
      .catch(console.error);

    ipcRenderer.send("fe-ready");

    ipcRenderer.on("credentialspass", (event, data) => {
      console.log('CREDENTIALS!!', data);
      SetCredentials(data);
    });
  }, []);

  return (
    <>
      <Titlebar />
      <div id="swagger" />
    </>
  );
};

export default Home;
