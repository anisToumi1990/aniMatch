import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { SvgXml } from 'react-native-svg';

// SVG XML strings for animal auras
const svgMap: Record<string, string> = {
  owl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><circle cx="38" cy="45" r="5"/><circle cx="62" cy="45" r="5"/><path d="M50 55c-5.52 0-10 4.48-10 10h20c0-5.52-4.48-10-10-10z" fill="#fff"/></svg>`,
  wolf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M35 40l10 10M65 40l-10 10M40 65h20" stroke="#fff" strokeWidth="3"/></svg>`,
  deer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M30 30l20 20 20-20M50 70V50" stroke="#fff" strokeWidth="3"/></svg>`,
  bear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><circle cx="35" cy="45" r="5"/><circle cx="65" cy="45" r="5"/><path d="M50 65c-8.28 0-15-6.72-15-15h30c0 8.28-6.72 15-15 15z" fill="#fff"/></svg>`,
  lion: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><circle cx="35" cy="45" r="5"/><circle cx="65" cy="45" r="5"/><path d="M50 65c-8.28 0-15-6.72-15-15h30c0 8.28-6.72 15-15 15z" fill="#fff"/></svg>`,
  fox: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M30 40l20 20 20-20M40 65l10-10 10 10" stroke="#fff" strokeWidth="3"/></svg>`,
  cat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><circle cx="35" cy="45" r="3"/><circle cx="65" cy="45" r="3"/><path d="M40 60q10 10 20 0" stroke="#fff" strokeWidth="2" fill="none"/></svg>`,
  dolphin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M30 50c0-15 40-15 40 0s-40 15-40 0z" stroke="#fff" strokeWidth="2" fill="none"/></svg>`,
  peacock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M50 30v40M30 50h40M35 35l30 30M35 65l30-30" stroke="#fff" strokeWidth="2"/></svg>`,
  parrot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M40 40l20 20M40 60l20-20" stroke="#fff" strokeWidth="3"/></svg>`,
  snake: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M30 40c20 0 0 20 20 20s-20 20 0 20" stroke="#fff" strokeWidth="3" fill="none"/></svg>`,
  eagle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M30 50h40M30 40l20 20 20-20" stroke="#fff" strokeWidth="3"/></svg>`,
  elephant: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M35 40c0-5 15-5 15 0M65 40c0-5-15-5-15 0M35 65c10-10 20-10 30 0" stroke="#fff" strokeWidth="3" fill="none"/></svg>`,
  unicorn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><path d="M50 30l-10 20h20z" fill="#fff"/><path d="M30 60c5-5 35-5 40 0" stroke="#fff" strokeWidth="2" fill="none"/></svg>`,
  otter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 20c-16.57 0-30 13.43-30 30s13.43 30 30 30 30-13.43 30-30-13.43-30-30-30zm0 55c-13.81 0-25-11.19-25-25s11.19-25 25-25 25 11.19 25 25-11.19 25-25 25z" fill="#fff"/><circle cx="40" cy="45" r="3"/><circle cx="60" cy="45" r="3"/><path d="M35 60q15-10 30 0" stroke="#fff" strokeWidth="2" fill="none"/></svg>`,
};

interface SvgWrapperProps {
  animalName: string;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function SvgWrapper({ 
  animalName, 
  width = 100, 
  height = 100, 
  color = '#FFFFFF',
  backgroundColor = '#7E4EFF'
}: SvgWrapperProps) {
  // Convert animal name to lowercase for matching
  const animal = animalName.toLowerCase();
  
  // Get the SVG XML string, or use a default if not found
  const svgXml = svgMap[animal] || svgMap.owl;
  
  return (
    <View style={[styles.container, { width, height, backgroundColor }]}>
      <SvgXml xml={svgXml} width="80%" height="80%" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    overflow: 'hidden',
  },
}); 