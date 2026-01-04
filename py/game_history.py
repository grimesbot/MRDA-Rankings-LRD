# -*- coding: utf-8 -*-

team_abbrev_id_map = {
    "AUA": "2676a",
    "CWB": "2685a",
    "CBRD": "2686a",
    "CBB": "2687a",
    "CGRD": "2689a",
    "CTB": "2692a",
    "DGC": "2693a",
    "DMRD": "2694a",
    "ChCRD": "2696a",
    "CRD": "2699a",
    "MRD": "2702a",
    "PAN": "2714a",
    "PHH": "2715a",
    "PSOD": "2717a",
    "RCR": "2719a",
    "SDA": "2723a",
    "SWS": "2725a",
    "SLGK": "2727a",
    "TIL": "2733a",
    "TMRD": "2735a",
    "TNF": "2737a",
    "TRD": "3013a",
    "KMRD": "13122a",
    "PIT": "17403a",
    "DHR": "17404a",
    "DIS": "17908a",
    "BBRD": "17909a"
}

games = [
    [
        ('2023-04-22', 'PHH', 152, 'PIT', 172),
    ],
    [
        ('2023-05-06', 'KMRD', 81, 'TIL', 197),
        ('2023-05-06', 'SWS', 66, 'TIL', 250),
        ('2023-05-06', 'CTB', 109, 'SWS', 108),
        ('2023-05-06', 'CTB', 107, 'KMRD', 210),
        ('2023-05-07', 'CTB', 70, 'TIL', 279),
        ('2023-05-07', 'KMRD', 224, 'SWS', 128)
    ],
    [
        ('2023-05-12', 'TMRD', 168, 'ChCRD', 176),
    ],
    [
        ('2023-05-13', 'ChCRD', 148, 'TMRD', 173),
        ('2023-05-13', 'RCR', 100, 'SLGK', 0), #forfeit
        ('2023-05-13', 'TRD', 66, 'PIT', 533),
    ],
    [
        ('2023-05-14', 'TRD', 169, 'CGRD', 115),
    ],
    [
        ('2023-05-20', 'CBRD', 353, 'DMRD', 56),
        ('2023-05-20', 'CBRD', 334, 'CGRD', 46),
        ('2023-05-20', 'CGRD', 137, 'DMRD', 206),
    ],
    [
        ('2023-06-03', 'CGRD', 37, 'PHH', 208),
        ('2023-06-03', 'PHH', 96, 'TMRD', 91),
        ('2023-06-04', 'CGRD', 51, 'TMRD', 364),
    ],
    [
        ('2023-06-10', 'DMRD', 59, 'RCR', 339),
    ],
    [   #Sibling Rivalry
        ('2023-06-16', 'CBRD', 113, 'SDA', 236, 'Sibling Rivalry 2023'),
        ('2023-06-17', 'DGC', 230, 'SDA', 120, 'Sibling Rivalry 2023'),
        ('2023-06-17', 'DGC', 113, 'SLGK', 168, 'Sibling Rivalry 2023'),
        ('2023-06-17', 'SLGK', 284, 'CBRD', 77, 'Sibling Rivalry 2023'),
        ('2023-06-18', 'CBRD', 55, 'DGC', 413, 'Sibling Rivalry 2023'),
        ('2023-06-18', 'SDA', 75, 'SLGK', 290, 'Sibling Rivalry 2023'),
    ],
    [
        ('2023-06-24', 'MRD', 274, 'TNF', 261)
    ],    
    [   #DOTD
        ('2023-06-24', 'AUA', 135, 'PIT', 121, "Dawn on the Derby 2023"),
        ('2023-06-24', 'AUA', 43, 'CBB', 173, "Dawn on the Derby 2023"),
        ('2023-06-24', 'CWB', 172, 'DIS', 175, "Dawn on the Derby 2023"),
        ('2023-06-24', 'CWB', 147, 'CRD', 136, "Dawn on the Derby 2023"),
        ('2023-06-24', 'CBB', 124, 'PIT', 135, "Dawn on the Derby 2023"),
        ('2023-06-24', 'DIS', 180, 'CRD', 96, "Dawn on the Derby 2023"),
        ('2023-06-25', 'CWB', 232, 'AUA', 91, "Dawn on the Derby 2023"),
        ('2023-06-25', 'CBB', 102, 'DIS', 142, "Dawn on the Derby 2023"),
        ('2023-06-25', 'PIT', 122, 'CRD', 115, "Dawn on the Derby 2023"),
    ],
    [
        ('2023-07-08', 'CWB', 386, 'CGRD', 85),
        ('2023-07-08', 'CWB', 200, 'PHH', 147),
        ('2023-07-09', 'CGRD', 72, 'PHH', 252),
    ],
    [
        ('2023-07-15', 'ChCRD', 173, 'PSOD', 163, "Salem Slam"),
        ('2023-07-15', 'ChCRD', 81, 'CRD', 208, "Salem Slam"),
        ('2023-07-15', 'CRD', 176, 'PSOD', 175, "Salem Slam"),
        ('2023-07-15', 'RCR', 145, 'CBB', 132, "Salem Slam"),
    ],
    [
        ('2023-07-22', 'TIL', 217, 'TNF', 299)
    ],
    [
        ('2023-07-29', 'CGRD', 35, 'RCR', 313),
    ],
    [
        ('2023-07-29', 'MRD', 300, 'TNF', 147)
    ],
    [
        ('2023-09-09', 'TIL', 193, 'KMRD', 106)
    ],
    [   #WHC
        ('2023-10-21', 'CWB', 167, 'RCR', 134, "2023 Western Hemisphere Cup"),
        ('2023-10-21', 'CBB', 154, 'PHH', 44, "2023 Western Hemisphere Cup"),
        ('2023-10-21', 'CBB', 49, 'SLGK', 278, "2023 Western Hemisphere Cup"),
        ('2023-10-21', 'DGC', 228, 'CRD', 118, "2023 Western Hemisphere Cup"),
        ('2023-10-21', 'DIS', 130, 'SDA', 169, "2023 Western Hemisphere Cup"),
        ('2023-10-21', 'CRD', 201, 'PIT', 79, "2023 Western Hemisphere Cup"),
        ('2023-10-22', 'DIS', 162, 'PHH', 92, "2023 Western Hemisphere Cup"),
        ('2023-10-22', 'CWB', 123, 'SDA', 279, "2023 Western Hemisphere Cup"),
        ('2023-10-22', 'CWB', 43, 'SLGK', 291, "2023 Western Hemisphere Cup"),
        ('2023-10-22', 'DGC', 151, 'SLGK', 130, "2023 Western Hemisphere Cup"),
        ('2023-10-22', 'DGC', 243, 'SDA', 128, "2023 Western Hemisphere Cup"),
        ('2023-10-22', 'PIT', 115, 'RCR', 191, "2023 Western Hemisphere Cup"),
    ],
    [   #ACE Autumn Clash
        ('2023-11-18', 'DHR', 82, 'BBRD', 256, "ACE Autumn Clash"),
        ('2023-11-18', 'PAN', 111, 'BBRD', 193, "ACE Autumn Clash"),
        ('2023-11-18', 'DHR', 103, 'PAN', 158, "ACE Autumn Clash")
    ],
    [
        ('2023-11-25', 'TIL', 91, 'MRD', 219)
    ],

    #[   # Test Data
    #    ('2025-11-29', 'CTB', 1, 'DHR', 30, "Test Data")
    #]
]
