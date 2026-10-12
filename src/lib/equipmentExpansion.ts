// Curated free-weight and machine teaching. Sources reviewed 2026-10-13.
export const EXPANDED_EQUIPMENT = [
  {
    "id": "dumbbell",
    "name": "哑铃",
    "area": "全身",
    "cue": "短握柄两端配重，可单手独立握持；固定或可调哑铃均可，不含壶铃",
    "kind": "自由重量"
  },
  {
    "id": "barbell",
    "name": "杠铃",
    "area": "全身",
    "cue": "可自由移动的长直杆，两侧配重或装片套筒；不含史密斯导轨杆、曲杆、陷阱杆",
    "kind": "自由重量"
  },
  {
    "id": "cable_station",
    "name": "龙门架 / 绳索器械",
    "area": "全身",
    "cue": "可调高低滑轮、拉索、配重堆及可换把手的绳索训练站；需用户确认配件",
    "kind": "固定器械"
  },
  {
    "id": "smith_machine",
    "name": "史密斯机",
    "area": "全身",
    "cue": "杠杆两端固定在导轨，有旋转挂钩与安全挡块；区别自由杠铃",
    "kind": "固定器械"
  },
  {
    "id": "seated_leg_curl",
    "name": "坐姿腿弯举机",
    "area": "腿部",
    "cue": "坐姿靠背、压大腿垫及托在脚踝下方滚垫，向座椅下屈膝",
    "kind": "固定器械"
  },
  {
    "id": "hip_abduction",
    "name": "髋外展机",
    "area": "臀部",
    "cue": "坐姿靠背，膝外侧垫面用于向外打开双腿；向内夹的内收机不属于此类",
    "kind": "固定器械"
  }
] as const

export const EXPANDED_EXERCISES = [
  {
    "equipmentId": "dumbbell",
    "id": "db-bench",
    "name": "哑铃平板卧推",
    "exercise": "哑铃平板卧推",
    "area": "胸部",
    "condition": "一对哑铃、平板训练凳。",
    "description": "仰卧将哑铃从胸侧推起。",
    "videoId": "1V3vpcaxRYQ",
    "seconds": 60,
    "publisher": "Davis Diley",
    "startSeconds": 0,
    "endSeconds": 60,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/chest/bench-press/dumbbell-bench-press/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-incline-press",
    "name": "哑铃上斜卧推",
    "exercise": "哑铃上斜卧推",
    "area": "胸部",
    "condition": "一对哑铃、可调训练凳，靠背约 30–45°。",
    "description": "在上斜凳上完成胸部推举。",
    "videoId": "IVcXHPhwLZk",
    "seconds": 46,
    "publisher": "Impact Fitness",
    "startSeconds": 0,
    "endSeconds": 46,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/chest/bench-press/incline-dumbbell-press/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-floor-press",
    "name": "哑铃地板卧推",
    "exercise": "哑铃地板卧推",
    "area": "胸部",
    "condition": "一对哑铃、平整防滑地面或训练垫。",
    "description": "利用地面限制下放幅度，完成胸前推举。",
    "videoId": "ZUgV41jlAWs",
    "seconds": 47,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 47,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/chest/bench-press/dumbbell-bench-press/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-one-arm-row",
    "name": "哑铃单臂划船",
    "exercise": "哑铃单臂划船",
    "area": "背部",
    "condition": "一只哑铃、稳固的训练凳或支撑面。",
    "description": "一手支撑身体，另一手将哑铃拉向髋侧。",
    "videoId": "qYB7blmD8Ag",
    "seconds": 55,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 55,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/back/rows/single-arm-dumbbell-row/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-shoulder-press",
    "name": "哑铃站姿肩推",
    "exercise": "哑铃站姿肩推",
    "area": "肩部",
    "condition": "一对轻哑铃、头顶留足空间。",
    "description": "站稳后从肩部两侧向上推举。",
    "videoId": "daga5z_4nnc",
    "seconds": 60,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 60,
    "videoNote": "讲解片段 00:00–01:00 · 可打开来源看完整视频",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/shoulder-press/dumbbell-shoulder-press/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-lateral-raise",
    "name": "哑铃侧平举",
    "exercise": "哑铃侧平举",
    "area": "肩部",
    "condition": "一对轻哑铃、两侧留足空间。",
    "description": "双臂向身体两侧抬起，练习肩部控制。",
    "videoId": "oNIEUWJigkQ",
    "seconds": 55,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 55,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/lateral-raises/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-rear-fly",
    "name": "哑铃俯身反向飞鸟",
    "exercise": "哑铃俯身反向飞鸟",
    "area": "肩部",
    "condition": "一对轻哑铃、可稳定俯身的站位。",
    "description": "俯身向两侧展开手臂，练习肩后侧。",
    "videoId": "eUJ-b_w9T5I",
    "seconds": 56,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 56,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/rear-delt-exercises/rear-delt-flyes/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-incline-curl",
    "name": "哑铃上斜弯举",
    "exercise": "哑铃上斜弯举",
    "area": "手臂",
    "condition": "一对哑铃、靠背约 45–60° 的训练凳。",
    "description": "靠在上斜凳上，固定上臂完成弯举。",
    "videoId": "KB7wx8LMlSY",
    "seconds": 46,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 46,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/bicep-curl/incline-bicep-curls/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-hammer-curl",
    "name": "哑铃锤式弯举",
    "exercise": "哑铃锤式弯举",
    "area": "手臂",
    "condition": "一对哑铃、稳固站位。",
    "description": "掌心相对，像握锤一样完成弯举。",
    "videoId": "Vhj0DewiLpg",
    "seconds": 45,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 45,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/bicep-curl/hammer-curls/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-overhead-extension",
    "name": "哑铃颈后臂屈伸",
    "exercise": "哑铃颈后臂屈伸",
    "area": "手臂",
    "condition": "一只轻哑铃，双手托稳一端；头顶留足空间。",
    "description": "上臂保持稳定，弯伸手肘移动哑铃。",
    "videoId": "jWe22yB5FXs",
    "seconds": 55,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 55,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/tricep-extension/overhead-tricep-extension/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-goblet-squat",
    "name": "哑铃高脚杯深蹲",
    "exercise": "哑铃高脚杯深蹲",
    "area": "腿臀",
    "condition": "一只哑铃，双手托在胸前。",
    "description": "将重量靠近胸前，控制下蹲和站起。",
    "videoId": "P0XO0XhKAX8",
    "seconds": 45,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 45,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/legs/quad-exercises/squats/goblet-squat/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-rdl",
    "name": "哑铃罗马尼亚硬拉",
    "exercise": "哑铃罗马尼亚硬拉",
    "area": "腿臀",
    "condition": "一对哑铃，先用轻重量学习屈髋。",
    "description": "臀部向后移动，沿腿侧下放哑铃再站起。",
    "videoId": "c6Kp79TblOk",
    "seconds": 60,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 60,
    "videoNote": "讲解片段 00:00–01:00 · 可打开来源看完整视频",
    "guideSource": "https://www.puregym.com/exercises/legs/hamstring-exercises/deadlifts/romanian-deadlift/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-reverse-lunge",
    "name": "哑铃后撤弓步",
    "exercise": "哑铃后撤弓步",
    "area": "腿臀",
    "condition": "一对哑铃，先徒手确认平衡；身后留足空间。",
    "description": "一腿向后迈步下蹲，再推地回到站姿。",
    "videoId": "F20_zRsn9hQ",
    "seconds": 52,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 52,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/legs/quad-exercises/lunges/reverse-lunges/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-split-squat",
    "name": "哑铃分腿蹲",
    "exercise": "哑铃分腿蹲",
    "area": "腿臀",
    "condition": "一对哑铃，前后分腿，双脚均在地面。",
    "description": "保持脚位不变，完成单侧屈膝下蹲。",
    "videoId": "uyzVYAMhrEo",
    "seconds": 53,
    "publisher": "Famme",
    "startSeconds": 0,
    "endSeconds": 53,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/legs/quad-exercises/squats/split-squats/"
  },
  {
    "equipmentId": "dumbbell",
    "id": "db-chest-supported-row",
    "name": "哑铃胸托划船",
    "exercise": "哑铃胸托划船",
    "area": "背部",
    "condition": "一对哑铃、锁稳的上斜训练凳。",
    "description": "胸部贴凳支撑身体，双手向髋侧拉铃。",
    "videoId": "2Q8MY1NHg-Q",
    "seconds": 60,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 60,
    "videoNote": "讲解片段 00:00–01:00 · 可打开来源看完整视频",
    "guideSource": "https://www.puregym.com/exercises/back/rows/incline-row/"
  },
  {
    "equipmentId": "barbell",
    "id": "bb-bench",
    "name": "杠铃平板卧推",
    "exercise": "杠铃平板卧推",
    "area": "胸部",
    "condition": "卧推凳、杠铃架及保护杆；初学者请现场教练协助。",
    "description": "控制杠铃下降至胸前，再推回上方。",
    "videoId": "hWbUlkb5Ms4",
    "seconds": 51,
    "publisher": "Jeff Nippard",
    "startSeconds": 0,
    "endSeconds": 51,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/chest/bench-press/barbell-bench-press/"
  },
  {
    "equipmentId": "barbell",
    "id": "bb-squat",
    "name": "杠铃背蹲",
    "exercise": "杠铃背蹲",
    "area": "腿臀",
    "condition": "深蹲架、保护杆；先请教练确认架高与回架方式。",
    "description": "将杠铃稳定放在上背，完成下蹲和站起。",
    "videoId": "MLoZuAkIyZI",
    "seconds": 60,
    "publisher": "Davis Diley",
    "startSeconds": 0,
    "endSeconds": 60,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/legs/quad-exercises/squats/barbell-back-squat/"
  },
  {
    "equipmentId": "barbell",
    "id": "bb-rdl",
    "name": "杠铃罗马尼亚硬拉",
    "exercise": "杠铃罗马尼亚硬拉",
    "area": "腿臀",
    "condition": "可控轻杠铃、平整场地；先掌握屈髋。",
    "description": "保持膝微弯，沿腿下放杠铃再伸髋站起。",
    "videoId": "7j-2w4-P14I",
    "seconds": 42,
    "publisher": "Nuffield Health",
    "startSeconds": 0,
    "endSeconds": 42,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/legs/hamstring-exercises/deadlifts/romanian-deadlift/"
  },
  {
    "equipmentId": "barbell",
    "id": "bb-row",
    "name": "杠铃俯身划船",
    "exercise": "杠铃俯身划船",
    "area": "背部",
    "condition": "轻杠铃、可保持稳定俯身的场地。",
    "description": "固定躯干，向腹部方向拉回杠铃。",
    "videoId": "Nqh7q3zDCoQ",
    "seconds": 53,
    "publisher": "Jeremy Ethier Shorts",
    "startSeconds": 0,
    "endSeconds": 53,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/back/rows/barbell-bent-over-row/"
  },
  {
    "equipmentId": "cable_station",
    "id": "cable-pushdown",
    "name": "绳索肱三头肌下压",
    "exercise": "绳索肱三头肌下压",
    "area": "手臂",
    "condition": "高位滑轮、直杆或绳索把手，先确认扣具锁牢。",
    "description": "固定上臂，向下伸肘完成下压。",
    "videoId": "qgo6y3-huLA",
    "seconds": 50,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 50,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/tricep-extension/tricep-pushdowns/"
  },
  {
    "equipmentId": "cable_station",
    "id": "cable-curl",
    "name": "绳索弯举",
    "exercise": "绳索弯举",
    "area": "手臂",
    "condition": "低位滑轮、直杆或弯杆把手，扣具需锁牢。",
    "description": "面向滑轮，保持上臂稳定完成弯举。",
    "videoId": "HLXSbKQjm0U",
    "seconds": 51,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 51,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/bicep-curl/cable-bicep-curls/"
  },
  {
    "equipmentId": "cable_station",
    "id": "cable-face-pull",
    "name": "绳索面拉",
    "exercise": "绳索面拉",
    "area": "肩部",
    "condition": "高位滑轮、双头绳索，扣具需锁牢。",
    "description": "向面部方向拉开绳索，练习肩后侧。",
    "videoId": "mOHd_d1UPCg",
    "seconds": 47,
    "publisher": "Danny Matranga",
    "startSeconds": 0,
    "endSeconds": 47,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/arms-and-shoulders/rear-delt-exercises/face-pulls/"
  },
  {
    "equipmentId": "smith_machine",
    "id": "smith-bench",
    "name": "史密斯平板卧推",
    "exercise": "史密斯平板卧推",
    "area": "胸部",
    "condition": "平凳、可用的安全挡块；先确认解锁和回挂方式。",
    "description": "沿器械轨道完成平板卧推。",
    "videoId": "QCjETTKb1l8",
    "seconds": 55,
    "publisher": "Prep Coach UK",
    "startSeconds": 0,
    "endSeconds": 55,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.strengthlog.com/smith-machine-bench-press/"
  },
  {
    "equipmentId": "seated_leg_curl",
    "id": "seated-curl",
    "name": "坐姿腿弯举",
    "exercise": "坐姿腿弯举",
    "area": "腿臀",
    "condition": "坐姿腿弯举机；区别于俯卧式和腿屈伸机。",
    "description": "坐稳后屈膝，将脚跟向座椅下方拉回。",
    "videoId": "EqCsK_vlnfE",
    "seconds": 49,
    "publisher": "Morgan, M.S., CPT, WFS, FNS",
    "startSeconds": 0,
    "endSeconds": 49,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/legs/hamstring-exercises/hamstring-curls/seated-leg-curl/"
  },
  {
    "equipmentId": "hip_abduction",
    "id": "hip-abduction",
    "name": "坐姿髋外展",
    "exercise": "坐姿髋外展",
    "area": "腿臀",
    "condition": "外侧膝垫向外推的髋外展机；区别于向内夹腿。",
    "description": "保持身体稳定，将双腿向外推开再控制合回。",
    "videoId": "xqYPENbin2A",
    "seconds": 55,
    "publisher": "Emily Elle",
    "startSeconds": 0,
    "endSeconds": 55,
    "videoNote": "动作短讲解 · 可打开来源看原片",
    "guideSource": "https://www.puregym.com/exercises/legs/inner-outer-thigh/seated-hip-abduction/"
  }
] as const

export const EXPANDED_GUIDES = {
  "db-bench": [
    {
      "instruction": "先用轻哑铃，坐稳后躺上平凳，双脚踩实地面。"
    },
    {
      "instruction": "肩胛贴凳，哑铃位于胸部两侧，手腕放正。",
      "mistake": "手肘横向张得过开。"
    },
    {
      "instruction": "平稳推到胸部上方，两侧同步伸臂。",
      "mistake": "撞击哑铃、抬臀借力。"
    },
    {
      "instruction": "缓慢下放到可控范围，再重复推起。",
      "mistake": "突然下坠、过度拉肩。"
    }
  ],
  "db-incline-press": [
    {
      "instruction": "锁稳上斜凳，先选轻重量，双脚踩地再躺稳。"
    },
    {
      "instruction": "肩背贴凳，将哑铃放在胸部两侧。",
      "mistake": "靠背过直变成肩推。"
    },
    {
      "instruction": "双手向上推起，手腕保持自然直立。",
      "mistake": "耸肩、两侧高低不一。"
    },
    {
      "instruction": "沿原路缓慢回位，保持肘部受控。",
      "mistake": "抬臀借力、放得过深。"
    }
  ],
  "db-floor-press": [
    {
      "instruction": "先用轻哑铃，仰卧屈膝，双脚踩稳地面。"
    },
    {
      "instruction": "上臂靠近身体两侧，手腕与前臂保持对齐。",
      "mistake": "肘部向两侧过度张开。"
    },
    {
      "instruction": "将哑铃平稳推到胸部上方，身体保持稳定。",
      "mistake": "抬臀、撞击哑铃。"
    },
    {
      "instruction": "慢慢下降，上臂轻触地面后再次推起。",
      "mistake": "手肘砸地、借反弹推起。"
    }
  ],
  "db-one-arm-row": [
    {
      "instruction": "一手撑稳训练凳，双脚站稳，俯身让背部平直。"
    },
    {
      "instruction": "持铃手自然下垂，收紧腹部、肩部放低。",
      "mistake": "塌腰、扭转躯干。"
    },
    {
      "instruction": "肘部向后带动哑铃，拉到身体侧面。",
      "mistake": "猛甩、耸肩拉向脖子。"
    },
    {
      "instruction": "缓慢伸臂回位，一侧完成再换另一侧。",
      "mistake": "身体跟着重量上下晃。"
    }
  ],
  "db-shoulder-press": [
    {
      "instruction": "先用轻哑铃，双脚约与髋同宽，站稳后举至肩侧。"
    },
    {
      "instruction": "腹部收紧、手腕放正，前臂大致朝上。",
      "mistake": "腰部过度后仰。"
    },
    {
      "instruction": "平稳向头顶推起，保持身体和双腿稳定。",
      "mistake": "蹬腿借力、耸肩猛推。"
    },
    {
      "instruction": "缓慢回到肩侧，保持两手速度一致。",
      "mistake": "快速下坠、失控外翻。"
    }
  ],
  "db-lateral-raise": [
    {
      "instruction": "双脚踩稳，双手持轻哑铃，自然垂在身体两侧。"
    },
    {
      "instruction": "收紧腹部，肘部留微弯，肩部保持放松。",
      "mistake": "耸肩、手腕折弯。"
    },
    {
      "instruction": "双臂向两侧抬至接近肩高，保持动作平稳。",
      "mistake": "甩动身体、抬得过高。"
    },
    {
      "instruction": "沿原路慢慢放回，两侧保持一致。",
      "mistake": "突然松力、靠惯性反弹。"
    }
  ],
  "db-rear-fly": [
    {
      "instruction": "持轻哑铃，屈髋俯身，膝微弯，保持背部平直。"
    },
    {
      "instruction": "手臂垂在身前，收紧腹部，肘部微弯。",
      "mistake": "弓背、抬头过度。"
    },
    {
      "instruction": "向两侧展开双臂，到与躯干大致齐平。",
      "mistake": "耸肩、用身体猛甩。"
    },
    {
      "instruction": "慢慢将哑铃合回起点，保持俯身位置。",
      "mistake": "抬起躯干、变成划船。"
    }
  ],
  "db-incline-curl": [
    {
      "instruction": "调稳上斜凳，持轻哑铃坐好，双脚踩实地面。"
    },
    {
      "instruction": "肩背贴靠背，双臂自然下垂，掌心朝前。",
      "mistake": "肩部离凳、过度拉肩。"
    },
    {
      "instruction": "上臂位置保持稳定，弯肘将哑铃提起。",
      "mistake": "前后摆肘、身体借力。"
    },
    {
      "instruction": "缓慢伸肘放回，始终控制重量。",
      "mistake": "哑铃下坠、猛伸手肘。"
    }
  ],
  "db-hammer-curl": [
    {
      "instruction": "双脚踩稳，双手持轻哑铃，掌心朝向身体两侧。"
    },
    {
      "instruction": "肩部放松，上臂靠近躯干，腹部保持收紧。",
      "mistake": "耸肩、腰背后仰。"
    },
    {
      "instruction": "保持掌心相对，弯肘将哑铃平稳提起。",
      "mistake": "甩动重量、手腕折弯。"
    },
    {
      "instruction": "慢慢伸肘回位，左右保持控制。",
      "mistake": "手肘前移、突然放下。"
    }
  ],
  "db-overhead-extension": [
    {
      "instruction": "双手托稳轻哑铃一端，站稳后举到头顶上方。"
    },
    {
      "instruction": "腹部收紧，上臂靠近头侧，保持身体稳定。",
      "mistake": "塌腰、肘部过度外张。"
    },
    {
      "instruction": "缓慢弯肘，让哑铃在脑后下降到舒适范围。",
      "mistake": "碰头、肩部跟着摆动。"
    },
    {
      "instruction": "平稳伸肘回到起点，全程握稳重量。",
      "mistake": "猛甩上推、突然松手。"
    }
  ],
  "db-goblet-squat": [
    {
      "instruction": "双手托住哑铃靠近胸口，双脚踩稳、脚尖略向外。"
    },
    {
      "instruction": "收紧腹部，屈髋屈膝缓慢下蹲。",
      "mistake": "弓背、哑铃离胸太远。"
    },
    {
      "instruction": "膝盖顺着脚尖方向，到可稳定控制的深度。",
      "mistake": "膝内扣、脚跟离地。"
    },
    {
      "instruction": "全脚掌推地站起，保持胸口与背部稳定。",
      "mistake": "起身后过度顶髋后仰。"
    }
  ],
  "db-rdl": [
    {
      "instruction": "双脚约与髋同宽，哑铃放在腿前，膝盖微弯。"
    },
    {
      "instruction": "收紧腹部，将臀部向后推，背部保持平直。",
      "mistake": "弓背、变成深蹲。"
    },
    {
      "instruction": "哑铃贴近腿下降，到大腿后侧有拉伸感即停。",
      "mistake": "强求触地、重量离腿。"
    },
    {
      "instruction": "通过伸髋站回原位，哑铃沿腿回升。",
      "mistake": "起身后仰、耸肩提铃。"
    }
  ],
  "db-reverse-lunge": [
    {
      "instruction": "双手持轻哑铃垂在两侧，双脚约与髋同宽站稳。"
    },
    {
      "instruction": "一脚向后迈步，屈膝下沉，前脚全脚掌着地。",
      "mistake": "两脚踩在同一直线上。"
    },
    {
      "instruction": "前膝跟随脚尖，后膝接近地面时保持控制。",
      "mistake": "膝内扣、身体前扑。"
    },
    {
      "instruction": "主要用前腿推地站回，一侧完成再换侧。",
      "mistake": "后腿猛蹬、哑铃摆动。"
    }
  ],
  "db-split-squat": [
    {
      "instruction": "持轻哑铃站稳，前后分腿并留出左右间距。"
    },
    {
      "instruction": "后脚跟抬起，收紧腹部，前脚全脚掌踩地。",
      "mistake": "两脚走钢丝般排直。"
    },
    {
      "instruction": "保持脚位，屈膝下蹲，后膝接近地面。",
      "mistake": "前膝内扣、撞击地面。"
    },
    {
      "instruction": "以前腿为主推地起身，完成后再换另一侧。",
      "mistake": "哑铃摇晃、身体前扑。"
    }
  ],
  "db-chest-supported-row": [
    {
      "instruction": "将训练凳调成上斜并锁稳，持轻哑铃俯卧贴凳。"
    },
    {
      "instruction": "胸部有支撑，双脚踩稳，双臂自然向下垂。",
      "mistake": "抬头过度、胸部离凳。"
    },
    {
      "instruction": "肘部向后拉，将哑铃提向身体两侧。",
      "mistake": "耸肩、用躯干弹起。"
    },
    {
      "instruction": "缓慢伸臂放回，全程保持胸部贴凳。",
      "mistake": "突然下坠、手腕折弯。"
    }
  ],
  "bb-bench": [
    {
      "instruction": "先用能控制的轻杆，调好保护杆，在卧推凳躺稳。"
    },
    {
      "instruction": "双脚踩地、肩胛贴凳，拇指环握杠杆。",
      "mistake": "空握、手腕过度后折。"
    },
    {
      "instruction": "出架后缓慢降向胸部，手肘保持受控。",
      "mistake": "杠铃砸胸、肘部外张。"
    },
    {
      "instruction": "平稳推起，结束时确认两侧挂稳再松手。",
      "mistake": "抬臀借力、仓促回架。"
    }
  ],
  "bb-squat": [
    {
      "instruction": "先用轻杆，调好深蹲架和保护杆，再将杠放稳上背。"
    },
    {
      "instruction": "双手握牢，站稳后小步出架，腹部收紧。",
      "mistake": "杠压颈部、出架慌乱。"
    },
    {
      "instruction": "屈髋屈膝下蹲到能控制的深度，膝跟随脚尖。",
      "mistake": "膝内扣、背部失稳。"
    },
    {
      "instruction": "全脚掌推地站起，确认两侧挂稳再松手。",
      "mistake": "顶髋后仰、抢着回架。"
    }
  ],
  "bb-rdl": [
    {
      "instruction": "双脚约与髋同宽，双手握稳轻杠铃，置于腿前。"
    },
    {
      "instruction": "膝微弯、收紧腹部，将臀部向后推。",
      "mistake": "弓背、过度屈膝。"
    },
    {
      "instruction": "杠铃贴腿下移，到能保持背部稳定的位置。",
      "mistake": "强求触地、杠离身体。"
    },
    {
      "instruction": "伸髋站回原位，双臂保持自然垂直。",
      "mistake": "后仰顶腰、用手臂硬拉。"
    }
  ],
  "bb-row": [
    {
      "instruction": "双脚踩稳，双手正握轻杠铃，握距略宽于肩。"
    },
    {
      "instruction": "屈髋俯身、膝微弯，收紧腹部保持背部平直。",
      "mistake": "塌腰、弓背。"
    },
    {
      "instruction": "手肘向后，将杠铃拉向腹部，躯干角度稳定。",
      "mistake": "身体猛起、耸肩借力。"
    },
    {
      "instruction": "缓慢伸臂回位，保持重量靠近身体。",
      "mistake": "突然放下、来回甩动。"
    }
  ],
  "cable-pushdown": [
    {
      "instruction": "把滑轮调到高位并锁稳，接好把手，先选轻重量。"
    },
    {
      "instruction": "双脚站稳、膝微弯，上臂贴近身体两侧。",
      "mistake": "塌腰、用身体压重量。"
    },
    {
      "instruction": "只让前臂转动，平稳下压至接近伸直。",
      "mistake": "肘部前后摆、猛锁肘。"
    },
    {
      "instruction": "慢慢屈肘回位，始终控制配重。",
      "mistake": "松手回弹、配重砸落。"
    }
  ],
  "cable-curl": [
    {
      "instruction": "把滑轮调到低位并锁稳，接好把手，先选轻重量。"
    },
    {
      "instruction": "面对器械站稳，掌心向上握杆，肘部靠近身体。",
      "mistake": "耸肩、手腕折弯。"
    },
    {
      "instruction": "保持上臂位置，弯肘将把手平稳提起。",
      "mistake": "后仰借力、手肘前移。"
    },
    {
      "instruction": "慢慢伸肘回位，配重始终保持可控。",
      "mistake": "突然松手、配重砸落。"
    }
  ],
  "cable-face-pull": [
    {
      "instruction": "调好滑轮高度并锁稳，接双头绳索，先选轻重量。"
    },
    {
      "instruction": "握住绳索后退站稳，收紧腹部，肩部保持放低。",
      "mistake": "大幅后仰、塌腰。"
    },
    {
      "instruction": "向面部拉开绳索，双手到脸侧，手肘朝外。",
      "mistake": "耸肩、拉向胸口。"
    },
    {
      "instruction": "短暂停留后慢慢伸臂回位，保持身体稳定。",
      "mistake": "猛拉猛放、配重砸落。"
    }
  ],
  "smith-bench": [
    {
      "instruction": "调好平凳和安全挡块，先用轻杆确认轨迹与回挂。"
    },
    {
      "instruction": "肩背贴凳、双脚踩稳，握距略宽于肩再解锁。",
      "mistake": "手腕后折、杠对脖子。"
    },
    {
      "instruction": "控制杠铃降向胸部，再沿轨道平稳推起。",
      "mistake": "砸胸反弹、抬臀借力。"
    },
    {
      "instruction": "结束时转动杠杆挂稳，核实两侧锁住再松手。",
      "mistake": "未挂稳就放手。"
    }
  ],
  "seated-curl": [
    {
      "instruction": "调靠背和滚垫，膝盖对齐转轴，脚踝放在滚垫上。"
    },
    {
      "instruction": "压腿垫固定大腿，背部贴垫，双手握稳把手。",
      "mistake": "抬臀、身体前后晃。"
    },
    {
      "instruction": "平稳屈膝，将脚跟拉向座椅下方并短暂停留。",
      "mistake": "猛拉重量、腿部甩动。"
    },
    {
      "instruction": "缓慢伸腿回位，膝盖保留微弯。",
      "mistake": "回弹锁膝、配重砸落。"
    }
  ],
  "hip-abduction": [
    {
      "instruction": "调好靠背、脚踏和膝垫，先选轻重量坐稳。"
    },
    {
      "instruction": "背部贴垫，膝外侧抵住垫面，双手握稳把手。",
      "mistake": "身体前扑、臀部离座。"
    },
    {
      "instruction": "双腿平稳向外打开，到舒适范围短暂停留。",
      "mistake": "强撑过大幅度、猛推。"
    },
    {
      "instruction": "慢慢合回起点，全程保持控制。",
      "mistake": "快速回弹、配重砸落。"
    }
  ]
} as const
