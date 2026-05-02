import{o as e,G as s}from"./index-Cfxe1HbK.js";import{g as t}from"./Layout-rkSGezls.js";import{U as r}from"./users-Cmw7-bzw.js";import{T as c}from"./triangle-alert-1MgV0tRu.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=e("Ear",[["path",{d:"M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0",key:"1dfaln"}],["path",{d:"M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4",key:"1qnva7"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=e("Focus",[["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}],["path",{d:"M3 7V5a2 2 0 0 1 2-2h2",key:"aa7l1z"}],["path",{d:"M17 3h2a2 2 0 0 1 2 2v2",key:"4qcy5o"}],["path",{d:"M21 17v2a2 2 0 0 1-2 2h-2",key:"6vwrx8"}],["path",{d:"M7 21H5a2 2 0 0 1-2-2v-2",key:"ioqczr"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=e("MessageSquare",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=e("Minus",[["path",{d:"M5 12h14",key:"1ays0h"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=e("PenTool",[["path",{d:"M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z",key:"nt11vn"}],["path",{d:"m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18",key:"15qc1e"}],["path",{d:"m2.3 2.3 7.286 7.286",key:"1wuzzi"}],["circle",{cx:"11",cy:"11",r:"2",key:"xmgehs"}]]),G=[1,2,3,5,10],M=[-1,-2,-3,-5],p={speaking:{icon:b,label:"Speaking",subTags:[{label:"Good Pronunciation",value:"good_pronunciation"},{label:"Loud & Clear",value:"loud_clear"},{label:"Great Vocabulary",value:"great_vocabulary"},{label:"Fluent Response",value:"fluent_response"}]},listening:{icon:u,label:"Listening",subTags:[{label:"Followed Instructions",value:"followed_instructions"},{label:"Good Comprehension",value:"good_comprehension"},{label:"Active Listening",value:"active_listening"}]},reading:{icon:t,label:"Reading",subTags:[{label:"Good Expression",value:"good_expression"},{label:"Accurate Reading",value:"accurate_reading"},{label:"Good Pace",value:"good_pace"}]},writing:{icon:d,label:"Writing",subTags:[{label:"Neat Handwriting",value:"neat_handwriting"},{label:"Good Grammar",value:"good_grammar"},{label:"Creative Writing",value:"creative_writing"}]}},_={focus:{icon:g,label:"Focus",subTags:[{label:"Stayed on Task",value:"stayed_on_task"},{label:"No Distractions",value:"no_distractions"}]},teamwork:{icon:r,label:"Teamwork",subTags:[{label:"Helped Others",value:"helped_others"},{label:"Good Collaboration",value:"good_collaboration"},{label:"Shared Materials",value:"shared_materials"}]}},h={icon:s,label:"Reading Theory",subTags:[{label:"Vocabulary Quiz",value:"vocabulary_quiz"},{label:"Grammar Exercise",value:"grammar_exercise"},{label:"Pronunciation Practice",value:"pronunciation_practice"},{label:"Comprehension Check",value:"comprehension_check"},{label:"Phonics Practice",value:"phonics_practice"}]},m=[{label:"Not Paying Attention",value:"not_paying_attention"},{label:"Disrupting Class",value:"disrupting_class"},{label:"Missing Homework",value:"missing_homework"},{label:"Late to Class",value:"late_to_class"},{label:"Other",value:"other"}],y={icon:c,label:"Correction",subTags:m},N={speaking:b,listening:u,reading:t,writing:d,focus:g,teamwork:r,correction:c,reading_theory:s};function k(a){return["speaking","listening","reading","writing"].includes(a)}function T(a){return["focus","teamwork"].includes(a)}function S(a){return k(a)||T(a)}function P(a,o){const l=p[a]||_[a]||(a==="correction"?y:null)||(a==="reading_theory"?h:null);if(!l)return a;const n=l.label;if(o){const i=l.subTags.find(v=>v.value===o);if(i)return`${n}: ${i.label}`}return n}export{_ as B,y as C,M as D,w as M,G as P,h as R,p as S,m as a,N as b,b as c,P as f,S as s};
