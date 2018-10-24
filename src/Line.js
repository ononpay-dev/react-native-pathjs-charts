/*
Copyright 2016 Capital One Services, LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.

SPDX-Copyright: Copyright (c) Capital One Services, LLC
SPDX-License-Identifier: Apache-2.0
*/

import React, { Component } from 'react';
import { Text as ReactText, View, PanResponder, Platform } from 'react-native';
import Svg, { G, Path, Rect, Text, Circle, Line, Ellipse, Image} from 'react-native-svg';
import { Colors, Options, cyclic, fontAdapt } from './util';
import Axis from './Axis';
import GridAxis from './GridAxis';
import _ from 'lodash';

export default class LineChart extends Component {
  constructor(props, chartType) {
    super(props);
    this.chartType = chartType;
    this.state = { 
      userPressing: false,
      selectedDataPoint: ''
    };
  }

  _calcDataPoint(evt) {
    let posX = evt.nativeEvent.locationX;
    let posY = evt.nativeEvent.locationY;
    posX -= this.props.options.margin.left;
    posY -= this.props.options.margin.top;

    let chartWidth = this.props.options.width;
    let chartHeight = this.props.options.height;

    posX = Math.max(posX, 0);
    posX = Math.min(posX, chartWidth);

    posY = Math.max(posY, 0);
    posY = Math.min(posY, chartHeight);
    // map the datapoint index with the gesture:
    let curPos = Math.min(posX / chartWidth, 1);
    let curPosY = Math.min(posY / chartHeight, 1);

    // create a 'focus' line
    let curPosX = posX;
    this.curPos = curPos;
    this.curPosY = curPosY;
    this.setState({curPos});
    this.setState({curPosX});
    this.setState({chartStartY: 0});
    this.setState({chartEndY: this.props.options.height});
  }

  componentWillMount() {
    this._panResponder = {};
    if (!this.props.options.interaction) {return;}
    this._panResponder = PanResponder.create({
      // Ask to be the responder:
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,

      onPanResponderGrant: (evt, gestureState) => {

        this.setState({userPressing: true});
        this._calcDataPoint(evt)

        if (this.props.panHandlerStart) {
          console.log(this.curPos, this.curPosY)
          this.props.panHandlerStart(this.curPos, this.curPosY);
        }
      },

      onPanResponderMove: (evt, gestureState) => {

        this._calcDataPoint(evt);
        if (this.props.panHandlerMove) {
          console.log('move')
          this.props.panHandlerMove(this.curPos, this.curPosY);
        }
      },

      onPanResponderRelease: (evt, gestureState) => {

        this._calcDataPoint(evt);
        if (this.props.panHandlerEnd) {
          console.log('end')
          this.props.panHandlerEnd(this.curPos, this.curPosY);
        }

        this.setState({userPressing: false});
      },

      onPanResponderTerminationRequest: (evt, gestureState) => true,


      onPanResponderTerminate: (evt, gestureState) => {

        this._calcDataPoint(evt);
        if (this.props.panHandlerEnd) {
          this.props.panHandlerEnd(this.curPos, this.curPosY);
        }

        this.setState({userPressing: false});
      },

      onShouldBlockNativeResponder: (evt, gestureState) => {
        return true;
      },
    });
  }

  getMaxAndMin(chart, key, scale, chartMin, chartMax) {
    let maxValue;
    let minValue;
    _.each(chart.curves, function(serie) {
      let values = _.map(serie.item, function(item) {
        return item[key];
      });

      let max = _.max(values);
      if (maxValue === undefined || max > maxValue) maxValue = max;
      let min = _.min(values);
      if (minValue === undefined || min < minValue) minValue = min;

      maxValue = chartMax > maxValue ? chartMax : maxValue;
      minValue = chartMin < minValue ? chartMin : minValue;
    });

    return {
      minValue: minValue,
      maxValue: maxValue,
      min: scale(minValue),
      max: scale(maxValue),
    };
  }

  color(i) {
    let color = this.props.options.color;
    if (!_.isString(this.props.options.color)) color = color.color;
    let pallete = this.props.pallete || Colors.mix(color || '#9ac7f7');
    return Colors.string(cyclic(pallete, i));
  }

  render() {
    const noDataMsg = this.props.noDataMessage || 'Chưa có dữ liệu';
    if (this.props.data === undefined) return <ReactText>{noDataMsg}</ReactText>;

    let options = new Options(this.props);

    let accessor = function(key) {
      return function(x) {
        return x[key];
      };
    };

    let chart = this.chartType({
      data: this.props.data,
      xaccessor: accessor(this.props.xKey),
      yaccessor: accessor(this.props.yKey),
      width: options.chartWidth,
      height: options.chartHeight,
      closed: false,
      min: options.min,
      max: options.max,
    });
    console.log(chart)

    let chartArea = {
      x: this.getMaxAndMin(chart, this.props.xKey, chart.xscale),
      y: this.getMaxAndMin(chart, this.props.yKey, chart.yscale, options.min, options.max),
      margin: options.margin,
    };

    let showAreas = typeof this.props.options.showAreas !== 'undefined'
      ? this.props.options.showAreas
      : true;
    let strokeWidth = typeof this.props.options.strokeWidth !== 'undefined'
      ? this.props.options.strokeWidth
      : '1';
    let strokeDasharray = typeof this.props.options.strokeDasharray !== 'undefined'
      ? this.props.options.strokeDasharray
      : [];
    let strokeOpacity = typeof this.props.options.strokeOpacity !== 'undefined'
      ? this.props.options.strokeOpacity
      : 1;
    let lines = _.map(
      chart.curves,
      function(c, i) {
        const strokeWidthForCurve =
          (typeof strokeWidth === 'function' && strokeWidth(c, i)) || strokeWidth;
        const strokeDasharrayForCurve =
          (typeof strokeDasharray === 'function' && strokeDasharray(c, i)) || strokeDasharray;
        const strokeOpacityForCurve =
          (typeof strokeOpacity === 'function' && strokeOpacity(c, i)) || strokeOpacity;
        return (
          <Path
            key={'lines' + i}
            d={c.line.path.print()}
            // stroke={this.color(i)}
            stroke={'rgb(208,212,219)'}
            strokeWidth={strokeWidthForCurve}
            strokeOpacity={strokeOpacityForCurve}
            fill="none"
            strokeDasharray={strokeDasharrayForCurve}
          />
        );
      }.bind(this)
    );
    const maxIndex = this.props.dataFinhay[0].length
    const indexNow = Number.parseInt(this.state.curPosX / ((options.chartWidth + 12) / maxIndex));
    const indexLast = Number.parseInt(this.state.curPosX / (options.chartWidth / maxIndex));
    let positionX = indexNow * ((options.chartWidth + 12) / maxIndex);
    if ( indexLast == maxIndex) {
      positionX =  (indexNow + 1) * ((options.chartWidth + 12)/ maxIndex);
    }
    let padding = 0;

    if (positionX < 2 * (options.chartWidth + 12) / maxIndex){
      padding = 10;
    }

    if (positionX > ((maxIndex - 2) * options.chartWidth + 12) / maxIndex){
      padding = -10;
    }
    if (positionX < (options.chartWidth + 12) / maxIndex){
      padding = 20;
    }

    if (positionX > ((maxIndex) * options.chartWidth + 12) / maxIndex){
      padding = -21;
    }
    // gesture line here
    let gestureLine = null;
    let color = 'white';
    let width = 1;
    if (this.props.options.cursorLine ) {
      if (this.props.options.cursorLine.stroke)
        color = this.props.options.cursorLine.stroke;
      if (this.props.options.cursorLine.strokeWidth) {
        width =this.props.options.cursorLine.strokeWidth;
      }
    }
    if (this.state.userPressing
      && this.props.options.interaction) {
      gestureLine = 
       <G>
       {/* <Image
            x={70}
            y={70}
            width={100}
            height={100}
            preserveAspectRatio="xMidYMid slice"
            // opacity={0.5}
            href={require('../../../src/assets/ic_clock_blue.png')}
            clipPath="url(#clip)"
            backgroundColor='red'
        /> */}
        {/* <Ellipse
          cx={this.state.curPosX - 2.5} cy={this.state.chartStartY - 22}
          rx="50"
          ry="13"
          fill={'rgb(74,173,204)'}
          clipPath={'url(#clip)'}
        >
        </Ellipse> */}
        {/* //full date */}
        {/* <Rect
                    x={this.state.curPosX - 50} 
                    y={this.state.chartStartY - 30}
                    width="100"
                    height="30" 
                    rx="17" 
                    ry="17"
                    fill={'rgb(74,173,204)'}
                /> */}

                 <Rect
                    x={positionX - 30 + padding} 
                    y={this.state.chartStartY - 42}
                    width="60"
                    height="27" 
                    rx="14" 
                    ry="14"
                    fill={'rgb(74,173,204)'}
                />

        {/* <Rect
          cx="70" 
          cy="70"
          rx="50"
          ry="13"
          width="10" height="80"
          fill={'rgb(74,173,204)'}
          clipPath={'url(#clip)'}
        /> */}

    />
        {/* {console.log(this.props.dataFinhay[0])}
        {console.log(this.props.data[0])} */}
        {/* {console.log(this.props.finhay(String(Math.floor(this.curPos * (this.props.dataFinhay[0].length - 1)))))} */}
        {/* {console.log(this.props.convert)}
        {console.log(this.props.dataFinhay[0])} */}
        {/* {console.log(this.props.dataFinhay[0].findIndex(this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1))))))} */}
        {/* {console.log(this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1)))))} */}
        {/* {console.log(this.props.dataFinhay[0][0])} */}
        {/* <Text x={this.state.curPosX - 7.5} y={this.state.chartStartY - 34}  fill={'white'} fontSize={14}>{this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1)))) == '8' ? 'hohoooo' : 'hihihihihi'}</Text> */}
        {/* <View x={this.state.curPosX - 20} y={this.state.chartStartY - 10} backgroundColor={'red'}></View> */}
        {/* <Image
            x={this.state.curPosX - 60 }
            cy={80}
            width={120}
            height={80}
            preserveAspectRatio="xMidYMid slice"
            // opacity={0.5}
            href={require('../../../src/assets/card_default.png')}
            clipPath="url(#clip)"
        /> */}
        {/* <Text x={this.state.curPosX - 35} y={this.state.chartStartY - 30}  fill={'white'} fontSize={12}>{this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1)))) == this.props.finhay(String(Math.floor(this.curPos * (this.props.dataFinhay[0].length - 1)))) ? this.props.dataFinhay[0][this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1))))].record_date : ''}</Text> */}
        {/* {this.props.showTotalMoney(this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1)))))} */}
        {console.log(this.props.dataFinhay[0])}
        <Text x={positionX - 19 + padding} y={this.state.chartStartY - (Platform.OS == 'ios' ? 39 : 37)}  fill={'white'} fontSize={15}>{this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1)))) == this.props.finhay(String(Math.floor(this.curPos * (this.props.dataFinhay[0].length - 1)))) ? this.props.dataFinhay[0][this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1))))].record_date.substring(0, 5).replace('-', '/') : ''}</Text>
        <Line
          x1={positionX}
          y1={this.state.chartStartY - 15}
          // y1={this.state.chartStartY - 10}
          x2={positionX}
          y2={this.state.chartEndY}
          stroke={color}
          strokeWidth={width}
        />
        {this.props.showTotalMoney(this.props.convert(String(Math.floor(this.curPos * (this.props.data[0].length - 1)))))}
        </G>
      
    } else {
      this.props.showTotalMoney(999999999)
    }

    let areas = null;

    let showPoints = typeof this.props.options.showPoints !== 'undefined'
      ? this.props.options.showPoints
      : false;
    let points = !showPoints
      ? []
      : _.map(
          chart.curves,
          function(c, graphIndex) {
            return _.map(
              c.line.path.points(),
              function(p, pointIndex) {
                let render = null;
                if (
                  (typeof showPoints === 'function' && showPoints(graphIndex, pointIndex)) ||
                  (typeof showPoints === 'boolean' && showPoints)
                ) {
                  return (
                    Number.parseInt(p[0]) == Number.parseInt(positionX) && gestureLine && <G key={'k' + pointIndex} x={p[0]} y={p[1]}>
                      {typeof this.props.options.renderPoint === 'function'
                        ? this.props.options.renderPoint(graphIndex, pointIndex)
                        : <Circle
                            fill={this.color(graphIndex)}
                            cx={0}
                            cy={0}
                            r={this.props.options.pointRadius || 3.5}
                            fillOpacity={1}
                          />}
                    </G>
                  );
                }
              }.bind(this)
            );
          }.bind(this)
        );

    if (showAreas) {
      areas = _.map(
        chart.curves,
        function(c, i) {
          if (
            (typeof showAreas === 'function' && showAreas(c, i)) ||
            typeof showAreas === 'boolean'
          )
            return (
              <Path
                key={'areas' + i}
                d={c.area.path.print()}
                fillOpacity={0.5}
                stroke="none"
                fill={'#ffffff'}
              />
            );

          return null;
        }.bind(this)
      );
    }

    let textStyle = fontAdapt(options.label);
    let regions;
    if (this.props.regions != 'undefined') {
      let styling = typeof this.props.regionStyling != 'undefined' ? this.props.regionStyling : {};
      let labelOffsetAllRegions = typeof styling.labelOffset != 'undefined'
        ? styling.labelOffset
        : {};

      regions = _.map(
        this.props.regions,
        function(c, i) {
          let x, y, height, width, y1, y2, labelX, labelY;

          let labelOffset = typeof c.labelOffset != 'undefined' ? c.labelOffset : {};
          let labelOffsetLeft = typeof labelOffsetAllRegions.left != 'undefined'
            ? typeof labelOffset.left != 'undefined' ? labelOffset.left : labelOffsetAllRegions.left
            : 20;
          let labelOffsetTop = typeof labelOffsetAllRegions.top != 'undefined'
            ? typeof labelOffset.top != 'undefined' ? labelOffset.top : labelOffsetAllRegions.top
            : 0;
          let fillOpacity = typeof styling.fillOpacity != 'undefined'
            ? typeof c.fillOpacity != 'undefined' ? c.fillOpacity : styling.fillOpacity
            : 0.5;

          y1 = chart.yscale(c.from);
          y2 = chart.yscale(c.to);

          x = 0;
          y = y1;
          height = y2 - y1;
          width = chartArea.x.max;

          labelX = labelOffsetLeft;
          labelY = y2 + labelOffsetTop;

          let regionLabel = typeof c.label != 'undefined'
            ? <Text
                fontFamily={textStyle.fontFamily}
                fontSize={textStyle.fontSize}
                fontWeight={textStyle.fontWeight}
                fontStyle={textStyle.fontStyle}
                fill={textStyle.fill}
                textAnchor="middle"
                x={labelX}
                y={labelY}
              >
                {c.label}
              </Text>
            : null;

          return (
            <G key={'region' + i}>
              <Rect
                key={'region' + i}
                x={x}
                y={y}
                width={width}
                height={height}
                fill={c.fill}
                fillOpacity={fillOpacity}
              />
              {regionLabel}
            </G>
          );
        }.bind(this)
      );
    }
    let returnValue = (
      <View width={options.width} height={options.height} {...this._panResponder.panHandlers}>
        <Svg width={options.width} height={options.height}>
        
          <G x={options.margin.left} y={options.margin.right + 35}>

            {/* <GridAxis key="grid-x" scale={chart.xscale} options={options.axisX} chartArea={chartArea} />
            <GridAxis key="grid-y" scale={chart.yscale} options={options.axisY} chartArea={chartArea} /> */}
            {regions}
            {areas}
            {lines}
            {points}
            {gestureLine}
            <Axis key="axis-x" scale={chart.xscale} options={options.axisX} chartArea={chartArea} />
            <Axis key="axis-y" scale={chart.yscale} options={options.axisY} chartArea={chartArea} />
          </G>
        </Svg>
      </View>
    );

    return returnValue;
  }
}
