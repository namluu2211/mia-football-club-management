
// Player type definition
export interface Player {
  id: number;
  firstName: string;
  lastName?: string;
  position: string;
  avatar?: string;
  videoUrl?: string;  // Short video URL (e.g., YouTube Shorts, TikTok, Instagram Reels)
  DOB?: number | string;  // Can be age number or date string
  height?: number;
  weight?: number;
  note?: string;
  scorer?: string;
  assist?: string;
  [key: string]: unknown; // Added to satisfy consumers expecting index signature
}

// Team division result
export interface TeamDivision {
  teamA: Player[];
  teamB: Player[];
}

// Position statistics result


/**
 * Calculate age from DOB (Date of Birth)
 * @param dob Date of Birth as number (age) or string (date format)
 * @returns Age in years, or null if cannot calculate
 */
export function calculateAge(dob: number | string | undefined): number | null {
  if (!dob) return null;
  
  // If DOB is a number, check if it's a year (birth year is typically > 100 and < 9999)
  if (typeof dob === 'number') {
    if (dob > 100 && dob < 9999) {
      // It's a year, calculate age from birth year
      const today = new Date();
      return today.getFullYear() - dob;
    } else if (dob > 0 && dob < 100) {
      // It's already an age
      return dob;
    }
    return null;
  }
  
  // If it's a string, try to parse as date
  if (typeof dob === 'string') {
    try {
      // Try to parse common date formats: DD/MM/YYYY, YYYY-MM-DD, etc.
      const date = new Date(dob);
      if (isNaN(date.getTime())) return null;
      
      const today = new Date();
      let age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age--;
      }
      
      return age;
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}



/**
 * Divide players into two teams by position equivalence
 * @param players Array of Player objects
 * @returns Object with teamA and teamB arrays
 */
export function dividePlayersByPosition(players: Player[]): TeamDivision {
  console.log('🔄 dividePlayersByPosition called with', players.length, 'players');
  
  // Group players by position
  const grouped: Record<string, Player[]> = {};
  for (const p of players) {
    const position = p.position || 'Chưa xác định';
    console.log(`📝 Player: ${p.firstName} ${p.lastName || ''} - Position: "${position}"`);
    if (!grouped[position]) grouped[position] = [];
    grouped[position].push(p);
  }

  console.log('📊 Position groups:', Object.keys(grouped).map(pos => `${pos}: ${grouped[pos].length} players`));

  const teamA: Player[] = [];
  const teamB: Player[] = [];

  // Shuffle and alternate assignment for each position group
  Object.values(grouped).forEach(group => {
    const shuffled = shuffle(group);
    shuffled.forEach((player, idx) => {
      if (idx % 2 === 0) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    });
  });

  console.log('🎯 Division results:');
  console.log('  Team A:', teamA.map(p => `${p.firstName} (${p.position})`));
  console.log('  Team B:', teamB.map(p => `${p.firstName} (${p.position})`));

  return { teamA, teamB };
}

/**
 * Divide players into two teams by position with optimized age balance
 * Uses two-pointer pairing within each position to minimize age difference
 * @param players Array of Player objects
 * @returns Object with teamA and teamB arrays
 */
export function dividePlayersByPositionWithAgeBalance(players: Player[]): TeamDivision {
  console.log('\n⚖️ CHIA ĐỘI THEO VỊ TRÍ VÀ ĐỘ TUỔI (Pairing Algorithm)', players.length, 'players');
  
  // Group players by position
  const grouped: Record<string, Player[]> = {};
  for (const p of players) {
    const position = p.position || 'Chưa xác định';
    if (!grouped[position]) grouped[position] = [];
    grouped[position].push(p);
  }

  console.log('\n📊 VỊ TRÍ ĐƯỢC PHÂN NHÓM:', Object.keys(grouped).map(pos => `${pos}: ${grouped[pos].length} cầu thủ`));

  const teamA: Player[] = [];
  const teamB: Player[] = [];

  // Process each position group with age-balanced two-pointer pairing
  Object.entries(grouped).forEach(([position, positionPlayers]) => {
    console.log(`\n🏆 VỊ TRÍ: ${position} (${positionPlayers.length} cầu thủ)`);
    
    // Build player-age pairs
    const playerAges = positionPlayers.map(p => ({
      player: p,
      age: calculateAge(p.DOB) || 0,
      original: p
    }));

    // Sort by age
    playerAges.sort((a, b) => a.age - b.age);

    console.log(`  Sắp xếp theo tuổi: ${playerAges.map(pa => `${pa.original.firstName}(${pa.age} tuổi)`).join(', ')}`);

    // Two-pointer pairing: pair youngest with oldest, 2nd youngest with 2nd oldest, etc.
    let left = 0;
    let right = playerAges.length - 1;
    let pairNum = 1;
    let assignToA = true; // Alternate which team gets the pair starting with Team A

    while (left < right) {
      const leftPlayer = playerAges[left];   // Trẻ nhất
      const rightPlayer = playerAges[right]; // Già nhất
      const pairAvgAge = (leftPlayer.age + rightPlayer.age) / 2;

      // Both players from pair go to same team (pair: youngest + oldest)
      const team = assignToA ? 'A' : 'B';
      const emoji = assignToA ? '🔵' : '🟠';
      
      if (assignToA) {
        teamA.push(leftPlayer.player);
        teamA.push(rightPlayer.player);
      } else {
        teamB.push(leftPlayer.player);
        teamB.push(rightPlayer.player);
      }
      
      console.log(`  ${emoji} Cặp ${pairNum}: ${leftPlayer.original.firstName}(${leftPlayer.age}T) + ${rightPlayer.original.firstName}(${rightPlayer.age}T) → Team ${team} (TB=${pairAvgAge.toFixed(1)}T)`);

      assignToA = !assignToA; // Alternate for next pair
      left++;
      right--;
      pairNum++;
    }

    // Handle odd player (middle one when count is odd)
    if (left === right) {
      const middlePlayer = playerAges[left];
      const team = assignToA ? 'A' : 'B';
      const emoji = assignToA ? '🔵' : '🟠';
      
      if (assignToA) {
        teamA.push(middlePlayer.player);
      } else {
        teamB.push(middlePlayer.player);
      }
      
      console.log(`  ${emoji} Cầu thủ lẻ: ${middlePlayer.original.firstName}(${middlePlayer.age}T) → Team ${team}`);
    }
  });

  // Calculate final statistics
  let teamAAge = 0, teamAValidAges = 0;
  let teamBAge = 0, teamBValidAges = 0;

  for (const player of teamA) {
    const age = calculateAge(player.DOB);
    if (age !== null && age > 0) {
      teamAAge += age;
      teamAValidAges++;
    }
  }

  for (const player of teamB) {
    const age = calculateAge(player.DOB);
    if (age !== null && age > 0) {
      teamBAge += age;
      teamBValidAges++;
    }
  }

  const teamAAvgAge = teamAValidAges > 0 ? Math.round((teamAAge / teamAValidAges) * 10) / 10 : 0;
  const teamBAvgAge = teamBValidAges > 0 ? Math.round((teamBAge / teamBValidAges) * 10) / 10 : 0;
  const ageDiff = Math.abs(teamAAvgAge - teamBAvgAge);

  console.log('\n⚖️  CÂN BẰNG SỐ LƯỢNG CẦU THỦ:');
  console.log(`  Trước: Team A = ${teamA.length}, Team B = ${teamB.length}`);

  // Balance player count between teams
  while (teamA.length > teamB.length + 1) {
    // Find a player to move from Team A to Team B
    // Prefer to move from positions with more players in Team A
    const positionCountA: Record<string, number> = {};
    const positionCountB: Record<string, number> = {};
    
    for (const p of teamA) {
      const pos = p.position || 'Chưa xác định';
      positionCountA[pos] = (positionCountA[pos] || 0) + 1;
    }
    
    for (const p of teamB) {
      const pos = p.position || 'Chưa xác định';
      positionCountB[pos] = (positionCountB[pos] || 0) + 1;
    }
    
    // Find position where Team A has most excess
    let positionToMove = '';
    let maxExcess = 0;
    for (const [position, countA] of Object.entries(positionCountA)) {
      const countB = positionCountB[position] || 0;
      const excess = countA - countB;
      if (excess > maxExcess) {
        maxExcess = excess;
        positionToMove = position;
      }
    }
    
    // Find and move a player from this position
    if (positionToMove) {
      const playerIndex = teamA.findIndex(p => (p.position || 'Chưa xác định') === positionToMove);
      if (playerIndex !== -1) {
        const playerToMove = teamA[playerIndex];
        teamA.splice(playerIndex, 1);
        teamB.push(playerToMove);
        console.log(`  ↪️  Moved ${playerToMove.firstName} (${playerToMove.position}) from Team A to Team B`);
      }
    } else {
      break; // No valid position found, stop rebalancing
    }
  }

  // Move from Team B to Team A if needed (though less likely)
  while (teamB.length > teamA.length + 1) {
    const playerIndex = teamB.length - 1;
    const playerToMove = teamB[playerIndex];
    teamB.splice(playerIndex, 1);
    teamA.push(playerToMove);
    console.log(`  ↪️  Moved ${playerToMove.firstName} (${playerToMove.position}) from Team B to Team A`);
  }

  console.log(`  Sau: Team A = ${teamA.length}, Team B = ${teamB.length}`);

  // Recalculate ages after balancing
  teamAAge = 0;
  teamAValidAges = 0;
  teamBAge = 0;
  teamBValidAges = 0;

  for (const player of teamA) {
    const age = calculateAge(player.DOB);
    if (age !== null && age > 0) {
      teamAAge += age;
      teamAValidAges++;
    }
  }

  for (const player of teamB) {
    const age = calculateAge(player.DOB);
    if (age !== null && age > 0) {
      teamBAge += age;
      teamBValidAges++;
    }
  }

  const teamAAvgAgeFinal = teamAValidAges > 0 ? Math.round((teamAAge / teamAValidAges) * 10) / 10 : 0;
  const teamBAvgAgeFinal = teamBValidAges > 0 ? Math.round((teamBAge / teamBValidAges) * 10) / 10 : 0;
  const ageDiffFinal = Math.abs(teamAAvgAgeFinal - teamBAvgAgeFinal);

  console.log('\n✅ KẾT QUẢ CHIA ĐỘI:');
  console.log(`  🔵 Team A (${teamA.length} players): Tuổi TB = ${teamAAvgAgeFinal} tuổi`);
  console.log(`  🟠 Team B (${teamB.length} players): Tuổi TB = ${teamBAvgAgeFinal} tuổi`);
  console.log(`  ⚖️  Chênh lệch tuổi: ${ageDiffFinal} tuổi`);
  console.log('\n  Team A:', teamA.map(p => `${p.firstName} (${p.position}, ${calculateAge(p.DOB)}T)`).join(' | '));
  console.log('  Team B:', teamB.map(p => `${p.firstName} (${p.position}, ${calculateAge(p.DOB)}T)`).join(' | '));

  return { teamA, teamB };
}