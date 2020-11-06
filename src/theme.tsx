import React, { createContext, useContext } from 'react';
import { Platform } from 'react-native';
import type { ReactNode, ComponentType } from 'react';
import type { ScaledSize } from 'react-native';
import type { Style } from 'css-to-react-native';
import hashGenerate from './hashGenerate';

import { Units } from './types';
import { convertValue } from './convert';
import { formatValue } from './formatValues';

import { colorAttributes, lengthAttributes } from './attribute-sets';

export interface ThemeInterface {
  rem: number;
  sizes: { [key: string]: string };
  colors: { [key: string]: string };
  elevation: (value: number) => Style;
}

/**
 * This interface can be augmented by users to add types to `styled-components`' default theme
 * without needing to reexport `ThemedStyledComponentsModule`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Theme extends ThemeInterface { }

export let ThemeContext = createContext(null) as React.Context<Theme | null>;

export const setThemeContext = (ExternalThemeContext: React.Context<Theme | null>) => {
  ThemeContext = ExternalThemeContext;
};

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('missing theme context, wrap your app in a ThemeProvider');
  return theme;
};

export const withTheme = <P extends { children?: ReactNode }>(
  Component: ComponentType<P & { theme: Theme }>
): ComponentType<P> => {
  const ComponentWithTheme = (props: P) => {
    const theme = useTheme();
    return (
      <Component {...props} theme={theme}>
        {props.children || null}
      </Component>
    );
  };
  ComponentWithTheme.displayName = `WithTheme(${Component.displayName || Component.name})`;
  return ComponentWithTheme;
};

export const ThemeProvider = ({
  theme,
  children,
  rootCss,
  rootFont = '-apple-system, Roboto, sans-serif',
  disableOutlines = true,
}: {
  theme: Theme;
  children: ReactNode;
  rootCss?: string;
  rootFont?: string;
  rootBackgroundColor?: string;
  disableOutlines?: boolean;
}) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore cannot add colors to ThemeInterface because we don't want to restrict it
  const colors = theme.colors as Record<string, string>;

  return (
    <ThemeContext.Provider value={theme}>
      <>
        {Platform.OS === 'web' ? (
          <style
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
            dangerouslySetInnerHTML={{
              __html: `
                html, body, #root {
                  font-family: ${rootFont};
                  min-height: 100%;
                  font-size: ${theme.rem}px;
                }
                #root { display: flex; }
                ${disableOutlines ? 'textarea, select, input { outline: none; }' : ''}
                ${rootCss || ''}
              `,
            }}
            key="global_style"
          />
        ) : null}
        {children}
      </>
    </ThemeContext.Provider>
  );
};

// css-to-react-native only supports proper css color values, so we resolve color variables to transparent hex values when compiling the template strings and then transform them back and dynamically resolve them from the theme when rendering
let currentColorId = 1;

const themeVariables = {
  hexForVarName: new Map<string, string>([]),
  nameForHex: new Map<string, string>([]),
};

export const resolverLengsVariables = (variableName: string, fallback?: string): string => {
  if (!themeVariables.hexForVarName.has(variableName)) {
    const hash = hashGenerate();
    themeVariables.hexForVarName.set(variableName, hash);
    themeVariables.nameForHex.set(hash, variableName.substring(1));
  }

  if (fallback) {
    const varOne = themeVariables.hexForVarName.get(variableName);
    const varTwo = themeVariables.hexForVarName.get(variableName);
    return `${varOne} ${varTwo}`;
  }
  return themeVariables.hexForVarName.get(variableName)!;
};

export const resolveColorVariablePlaceholder = (
  variableName: string,
  fallback?: string
): string => {
  if (!themeVariables.hexForVarName.has(variableName)) {
    const hash = `#${(currentColorId++).toString(16).padStart(6, '0').toUpperCase()}00`;

    themeVariables.hexForVarName.set(variableName, hash);
    themeVariables.nameForHex.set(hash, variableName.substring(1));
  }

  if (fallback) {
    const varOne = themeVariables.hexForVarName.get(variableName);
    const varTwo = themeVariables.hexForVarName.get(variableName);
    return `${varOne} ${varTwo}`;
  }
  return themeVariables.hexForVarName.get(variableName)!;
};

// resolve any occurences of theme variables in the values of a style object
const plattformIsWeb = Platform.OS === 'web';

export const resolveLengthUnit = (
  str: string | number | undefined,
  theme: Theme,
  windowDimensions: ScaledSize
): number | string | undefined => {
  if (!str || typeof str === 'number') return str;
  if (typeof str !== 'string') throw new Error(`expected ${str} to be a string`);
  const value = Number.parseFloat(str);
  if (value === 0) return 0;
  const unit = str.trim().replace(String(value), '');
  if (!unit) throw new Error(`length string '${str}' contains no unit`);
  switch (unit) {
    case 'rem':
      return value * theme.rem || 8;
    case 'px':
      return value;
    case '%':
      return str;
    case 'vw':
      return (value * windowDimensions.width) / 100;
    case 'vh':
      return (value * windowDimensions.height) / 100;
    default:
      throw new Error(`cannot parse length string '${str}', unknown unit '${unit}'`);
  }
};

function findNestedObj(
  entireObj: Record<string, any>,
  keyToFind: string
): { [key: string]: string } | undefined {
  let foundObj;
  JSON.stringify(entireObj, (_, nestedValue: { [key: string]: string }) => {
    if (nestedValue && nestedValue[keyToFind]) {
      foundObj = nestedValue;
    }
    return nestedValue;
  });
  return foundObj;
}

export const resolveThemeVariables = (
  styleObject: { [key: string]: any },
  theme: Theme,
  windowDimensions: ScaledSize,
  units: Units
) => {
  for (const key in styleObject) {
    if (key === 'elevation' && theme.elevation) {
      const shadowStyleObject = theme.elevation(styleObject[key] as number);
      for (const shadowKey in shadowStyleObject) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore typescript doesn't understand that we are assigning the same keys here
        styleObject[shadowKey] = shadowStyleObject[shadowKey];
      }
    }

    if (key === 'cursor' && !plattformIsWeb) delete styleObject.cursor;

    if (colorAttributes.has(key)) {
      // This snippet of code is to prevent problems with the css-to-react-native module
      // When the user uses the variables to determine the values
      const nameVariables = themeVariables.nameForHex.get(styleObject[key]);

      if (nameVariables) {
        const findSize = findNestedObj(theme, nameVariables);

        if (findSize && findSize[nameVariables]) {
          styleObject[key] = findSize[nameVariables];
        } else {
          throw new Error(
            `the color variable '$${nameVariables}' has not been defined in the theme.`
          );
        }
      }
    }

    if (lengthAttributes.has(key)) {
      // console.log(key, styleObject[key])
      // This snippet of code is to prevent problems with the css-to-react-native module
      // When the user uses the variables to determine the values
      const nameVariables = themeVariables.nameForHex.get(`${styleObject[key]}px`);

      if (nameVariables) {
        const findSize = findNestedObj(theme, nameVariables);
        if (findSize && findSize[nameVariables]) {
          styleObject[key] = findSize[nameVariables];
        } else {
          throw new Error(`the variable '${nameVariables}' has not been defined in the theme.`);
        }
      }

      const keyValue = String(styleObject[key]);

      if (keyValue.startsWith('calc') || keyValue.startsWith('max') || keyValue.startsWith('min')) {
        const converted = convertValue(key, styleObject[key], units);
        if (!Number.isNaN(converted)) styleObject[key] = converted as number;
      }

      styleObject[key] = resolveLengthUnit(styleObject[key], theme, windowDimensions);
    }
  }

  const marginLeft = styleObject.marginLeft || undefined;
  const marginRight = styleObject.marginRight || undefined;
  const marginTop = styleObject.marginTop || undefined;
  const marginBottom = styleObject.marginBottom || undefined;

  if (marginLeft && marginRight & marginTop & marginBottom) {
    const widthValue = formatValue(styleObject, windowDimensions, 'width');

    const heightValue = formatValue(styleObject, windowDimensions, 'height');

    styleObject.width = resolveLengthUnit(widthValue, theme, windowDimensions);

    styleObject.height = resolveLengthUnit(heightValue, theme, windowDimensions);
  }
  return styleObject;
};
