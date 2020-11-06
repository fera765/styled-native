import { ScaledSize } from 'react-native';

export function formatValue(style: { [key: string]: any }, dimensions: ScaledSize, key: string): string | undefined {
  const widthValue = Number.parseFloat(style['width']);
  const heightValue = Number.parseFloat(style['height']);

  const unitWidth = String(style['width']).trim().replace(String(widthValue), '');
  const unitHeight = String(style['height']).trim().replace(String(heightValue), '');

  const returnValueWidth = (unitWidth === '' ? 'px' : unitWidth)
  const returnValueHeight = (unitHeight === '' ? 'px' : unitHeight)

  const somaRightLeft = style['marginLeft'] + style['marginRight'];
  const somaTopBottom = style['marginTop'] + style['marginBottom']

  if (style['width'] && key === 'width') {
    if (widthValue <= somaRightLeft)
      return `${widthValue}${returnValueWidth}`
    return `${widthValue - ((100 * somaRightLeft) / dimensions.width)}${returnValueWidth}`
  } else if (style['height'] && key === 'height') {
    if (heightValue <= somaTopBottom)
      return `${heightValue}${returnValueWidth}`
    return `${heightValue - ((100 * somaTopBottom) / dimensions.height)}${returnValueHeight}`
  }

  return undefined;
}
