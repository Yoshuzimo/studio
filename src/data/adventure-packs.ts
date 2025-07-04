// src/data/adventure-packs.ts
import type { AdventurePack } from '@/types';

// This is the master list for Adventure Packs.
// You can edit this list directly to add, remove, or modify packs.
// The Admin Panel's CSV uploader for Adventure Packs will generate a new version of this file's contents for you to copy-paste.
export const ADVENTURE_PACKS_DATA: AdventurePack[] = [
  { id: 'pack_001', name: 'Against the Slave Lords', pointsCost: 595, totalFavor: 48 },
  { id: 'pack_002', name: 'Attack on Stormreach', pointsCost: 450, totalFavor: 63 },
  { id: 'pack_003', name: 'Delera\'s Tomb', pointsCost: 850, totalFavor: 129 },
  { id: 'pack_004', name: 'Demon Sands', pointsCost: 950, totalFavor: 213 },
  { id: 'pack_005', name: 'Devil Assault', pointsCost: 350, totalFavor: 30 },
  { id: 'pack_006', name: 'Disciples of Rage', pointsCost: 725, totalFavor: 78 },
  { id: 'pack_007', name: 'Disciples of Shadow', pointsCost: null, totalFavor: 51 },
  { id: 'pack_008', name: 'Dragonblood Prophecy', pointsCost: 595, totalFavor: 57 },
  { id: 'pack_009', name: 'Eveningstar Challenge Pack', pointsCost: 695, totalFavor: 36 },
  { id: 'pack_010', name: 'Fables of the Feywild', pointsCost: 2495, totalFavor: 138 },
  { id: 'pack_011', name: 'Fall of the Night Brigade', pointsCost: 695, totalFavor: 39 },
  { id: 'pack_012', name: 'Free to Play', pointsCost: null, totalFavor: null },
  { id: 'pack_013', name: 'Grip of the Hidden Hand', pointsCost: 725, totalFavor: 96 },
  { id: 'pack_014', name: 'Harbinger of Madness', pointsCost: 450, totalFavor: 66 },
  { id: 'pack_015', name: 'Haunted Halls of Eveningstar', pointsCost: 650, totalFavor: 27 },
  { id: 'pack_016', name: 'Heart of Madness', pointsCost: 450, totalFavor: 63 },
  { id: 'pack_017', name: 'Hunter and Hunted', pointsCost: 595, totalFavor: 57 },
  { id: 'pack_018', name: 'Keep on the Borderlands', pointsCost: 995, totalFavor: 54 },
  { id: 'pack_019', name: 'Magic of Myth Drannor', pointsCost: 2995, totalFavor: 237 },
  { id: 'pack_020', name: 'Masterminds of Sharn', pointsCost: 2495, totalFavor: 282 },
  { id: 'pack_021', name: 'Menace of the Underdark', pointsCost: 2495, totalFavor: 369 },
  { id: 'pack_022', name: 'Mists of Ravenloft', pointsCost: 2495, totalFavor: 240 },
  { id: 'pack_023', name: 'Peril of the Planar Eyes', pointsCost: 650, totalFavor: 66 },
  { id: 'pack_024', name: 'Phiarlan Carnival', pointsCost: 450, totalFavor: 48 },
  { id: 'pack_025', name: 'Reign of Madness', pointsCost: 450, totalFavor: 81 },
  { id: 'pack_026', name: 'Ruins of Gianthold', pointsCost: 950, totalFavor: 240 },
  { id: 'pack_027', name: 'Secrets of the Artificers', pointsCost: 650, totalFavor: 159 },
  { id: 'pack_028', name: 'Sentinels of Stormreach', pointsCost: 450, totalFavor: 66 },
  { id: 'pack_029', name: 'Shadow Over Wheloon', pointsCost: null, totalFavor: 102 },
  { id: 'pack_030', name: 'Shadow Under Thunderholme', pointsCost: 550, totalFavor: 54 },
  { id: 'pack_031', name: 'Shadowfell Conspiracy', pointsCost: 2495, totalFavor: 216 },
  { id: 'pack_032', name: 'Sinister Secret of Saltmarsh', pointsCost: 1999, totalFavor: 90 },
  { id: 'pack_033', name: 'Slice of Life', pointsCost: 450, totalFavor: 54 },
  { id: 'pack_034', name: 'Sorrowdusk Isle', pointsCost: 450, totalFavor: 117 },
  { id: 'pack_035', name: 'Tangleroot Gorge', pointsCost: 550, totalFavor: 99 },
  { id: 'pack_036', name: 'Tavern Tales', pointsCost: 250, totalFavor: 66 },
  { id: 'pack_037', name: 'The Catacombs', pointsCost: 250, totalFavor: 66 },
  { id: 'pack_038', name: 'The Devil\'s Gambit', pointsCost: 450, totalFavor: 66 },
  { id: 'pack_039', name: 'The Devils of Shavarath', pointsCost: 550, totalFavor: 147 },
  { id: 'pack_040', name: 'The Dreaming Dark', pointsCost: 350, totalFavor: 78 },
  { id: 'pack_041', name: 'The Druid\'s Deep', pointsCost: 550, totalFavor: 75 },
  { id: 'pack_042', name: 'The High Road of Shadows', pointsCost: 750, totalFavor: 96 },
  { id: 'pack_043', name: 'The Isle of Dread', pointsCost: 3995, totalFavor: 150 },
  { id: 'pack_044', name: 'The Lost Gatekeepers', pointsCost: 725, totalFavor: 42 },
  { id: 'pack_045', name: 'The Mines of Tethyamar', pointsCost: 725, totalFavor: 75 },
  { id: 'pack_046', name: 'The Necropolis, Part 1', pointsCost: 350, totalFavor: 66 },
  { id: 'pack_047', name: 'The Necropolis, Part 2', pointsCost: 350, totalFavor: 81 },
  { id: 'pack_048', name: 'The Necropolis, Part 3', pointsCost: 350, totalFavor: 93 },
  { id: 'pack_049', name: 'The Necropolis, Part 4', pointsCost: 850, totalFavor: 138 },
  { id: 'pack_050', name: 'The Path of Inspiration', pointsCost: 350, totalFavor: 90 },
  { id: 'pack_051', name: 'The Reaver\'s Reach', pointsCost: 250, totalFavor: 96 },
  { id: 'pack_052', name: 'The Red Fens', pointsCost: 450, totalFavor: 54 },
  { id: 'pack_053', name: 'The Restless Isles', pointsCost: 350, totalFavor: 84 },
  { id: 'pack_054', name: 'The Ruins of Threnal', pointsCost: 450, totalFavor: 108 },
  { id: 'pack_055', name: 'The Seal of Shan-To-Kor', pointsCost: 250, totalFavor: 48 },
  { id: 'pack_056', name: 'The Secret of the Storm Horns', pointsCost: null, totalFavor: 96 },
  { id: 'pack_057', name: 'The Sharn Syndicate', pointsCost: 350, totalFavor: 36 },
  { id: 'pack_058', name: 'The Soul Splitter', pointsCost: 650, totalFavor: 114 },
  { id: 'pack_059', name: 'The Temple of Elemental Evil', pointsCost: 650, totalFavor: 105 },
  { id: 'pack_060', name: 'The Vale of Twilight', pointsCost: 995, totalFavor: 321 },
  { id: 'pack_061', name: 'The Vault of Night', pointsCost: 750, totalFavor: 126 },
  { id: 'pack_062', name: 'The Vaults of the Artificers', pointsCost: 1295, totalFavor: 126 },
  { id: 'pack_063', name: 'Three-Barrel Cove', pointsCost: 695, totalFavor: 126 },
  { id: 'pack_064', name: 'Trials of the Archons', pointsCost: 495, totalFavor: 81 },
  { id: 'pack_065', name: 'Vecna Unleashed', pointsCost: 1999, totalFavor: 264 },
  { id: 'pack_066', name: 'White Plume Mountain and Other Tales', pointsCost: 725, totalFavor: 69 }
];
