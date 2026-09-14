import fs from 'node:fs';

const path = 'src/pages/CustomStudio.jsx';
let source = fs.readFileSync(path, 'utf8');

const routerBefore = 'import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";';
const routerAfter = 'import { useLocation, useNavigate, useSearchParams } from "react-router-dom";';
const iconBefore = 'import { ArrowLeft, ArrowRight, Check, Upload, X, Star, Heart, Sparkles, ShieldCheck, AlertTriangle, Shirt, Plus, Minus, Maximize2, Move, Ruler, ZoomIn, ZoomOut, Lock, Unlock } from "lucide-react";';
const iconAfter = 'import { ArrowLeft, ArrowRight, Check, Upload, X, Star, Heart, Sparkles, ShieldCheck, AlertTriangle, Shirt, Maximize2, Move, Ruler, ZoomIn, ZoomOut, Lock, Unlock } from "lucide-react";';

if (source.includes(routerBefore)) source = source.replace(routerBefore, routerAfter);
else if (!source.includes(routerAfter)) throw new Error('Missing router import cleanup anchor.');

if (source.includes(iconBefore)) source = source.replace(iconBefore, iconAfter);
else if (!source.includes(iconAfter)) throw new Error('Missing icon import cleanup anchor.');

fs.writeFileSync(path, source);
console.log('Removed imports relocated to extracted Custom Studio steps.');
